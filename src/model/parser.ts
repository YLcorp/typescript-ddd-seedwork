import { Option, Either, S, Arr as A, Record, Apply } from '@logic/fp';
import {
  Parser,
  ParsingInput,
  StructValidationErr,
  Validation,
  ValidationErrByKey,
  ValidationTrait,
  ValueOfValidation,
  getErrorFromErrByKey,
  toValidationErr,
} from './invariant-validation';
import { apply, pipe } from 'fp-ts/lib/function';
import { Ord } from 'fp-ts/lib/Ord';
import { Semigroup } from 'fp-ts/lib/Semigroup';
import { randomUUID } from 'crypto';
import { P, match } from 'ts-pattern';
import { isObject } from 'util';
import { Magma } from 'fp-ts/lib/Magma';

export const optionizeParser =
  <T>(parser: Parser<T>) =>
  (optionV: Option.Option<unknown>) =>
    pipe(
      optionV,
      Option.map((v) => parser(v)),
      Option.sequence(Either.Applicative),
    );

const StrIntOrder: Ord<string> = {
  equals: S.Eq.equals,
  compare: (first, second) => {
    const fI = parseInt(first);
    const fS = parseInt(second);
    return fI < fS ? -1 : fI > fS ? 1 : 0;
  },
};

export const structSummarizerParsing = <T>(struct: ParsingInput<T>) => {
  const getValidationErrByKeySemigroup: () => Semigroup<ValidationErrByKey> =
    () => {
      const mutualKey = randomUUID();
      return {
        concat: (a: ValidationErrByKey, b: ValidationErrByKey) => {
          /* [[some(key_a), error], [none, error], [some(key_c), error], [some(mutual_key), concat_err]]
           *  => [[some(key_a), error], [none, error], [none, error], [some(mutual_key), { ...concat_err, key_c: error }]]
           *  => [[some(key_a), error], [none, error], [some(mutual_key), { ...concat_err, key_c: error, unknown: [error]}]]
           *  => [[some(key_a), error], [some(mutual_key), { ...concat_err, key_c: error, unknown: [error, error]}]]
           *  => result: [some(mutual_key), { ...concat_err, key_c: error, unknown: [error, error], key_a: error }]
           * */
          const getStructErr = (err: ValidationErrByKey) =>
            /* --- pair to record repr ---
             * [none, error] => { unknown: error }
             * [some(key), error] => { key: error }
             * [some(mutual_key), error_not_obj] => { abnormal: [error_not_obj] }
             * [some(mutual_key), error_obj] => error_obj (for continue to join with other normal { key: error })
             * */

            pipe(
              err[0],
              Option.matchW(
                () => ({ unknown: [err[1]] }),
                (keyA: string) =>
                  match([keyA, err[1]])
                    .with(
                      [mutualKey, P.when(isObject)],
                      () => err[1] as StructValidationErr,
                    )
                    .with([mutualKey, P.not(P.when(isObject))], () => ({
                      abnormal: [err[1]],
                    }))
                    .otherwise(() => ({ [keyA]: err[1] })),
              ),
            );
          const m: Magma<unknown> = {
            // for join errors with the same key in struct error
            concat: (a, b) => {
              const isJoinOfArray = Array.isArray(a) && Array.isArray(b);
              return isJoinOfArray ? [...a, ...b] : b;
            },
          };
          return [
            Option.some(mutualKey),
            pipe(
              Record.union,
              apply(m),
              apply(getStructErr(a)),
              apply(getStructErr(b)),
            ) as StructValidationErr,
          ];
        },
      };
    };

  const recordWithKeyValidation = Record.mapWithIndex(
    (k: string, a: Validation<unknown>) =>
      pipe(a, toValidationErr(Option.some(k))) as Either.Either<
        ValidationErrByKey,
        ValueOfValidation<typeof a>
      >,
  );
  const structValidate = Apply.sequenceS(
    Either.getApplicativeValidation(getValidationErrByKeySemigroup()),
  );
  return pipe(
    struct,
    recordWithKeyValidation,
    structValidate,
    Either.mapLeft(getErrorFromErrByKey),
    ValidationTrait.fromEitherWithCasting<T>,
  );
};

export const arrayParser =
  <T>(itemParser: Parser<T>) =>
  (a: unknown[]) => {
    return pipe(
      a,
      A.reduceWithIndex({}, (i, acc, cur) => ({
        ...acc,
        [i]: itemParser(cur),
      })),
      structSummarizerParsing<Record<number, T>>,
      Either.map(
        Record.reduce(StrIntOrder)([], (acc: T[], cur) => [...acc, cur]),
      ),
    );
  };

export const identityParser = <A>(value: unknown) => Either.of(value as A);