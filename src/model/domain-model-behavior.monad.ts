import { Arr, IOEither, State } from '@logic/fp';
import { DomainEvent } from './event/domain-event.base';
import { pipe } from 'fp-ts/lib/function';
import { BaseException } from '@logic/exception.base';
import { Validation } from './invariant-validation';
import { Entity } from './entity.base.type';

export interface IEventDispatcher {
  dispatch(event: DomainEvent): IOEither.IOEither<BaseException, void>;
  multiDispatch(events: DomainEvent[]): IOEither.IOEither<BaseException, void>;
}

export type BehaviorMonad<A extends Entity> = State.State<DomainEvent[], A>;

const map =
  <A extends Entity>(f: (a: A) => A) =>
  (fa: BehaviorMonad<A>) =>
    State.map(f)(fa);

const of = <A extends Entity>(aggregateState: A, itsEvent: DomainEvent[]) =>
  ((commingEvents: DomainEvent[]) => [
    aggregateState,
    Arr.getMonoid<DomainEvent>().concat(itsEvent, commingEvents),
  ]) as BehaviorMonad<A>;

const chain =
  <A extends Entity>(f: (a: A) => BehaviorMonad<A>) =>
  (ma: BehaviorMonad<A>) =>
  (s: DomainEvent[]) => {
    const state = ma(s);
    return f(state[0])(state[1]);
  };

const run =
  (eD: IEventDispatcher) =>
  <A extends Entity>(behavior: BehaviorMonad<A>, initEvents: DomainEvent[]) => {
    const [aggregate, events] = behavior(initEvents);
    return pipe(eD.multiDispatch(events), IOEither.as(aggregate));
  };

export type AggBehavior<A extends Entity, P, HasParser extends boolean> = (
  p: P,
) => (
  a: A,
) => HasParser extends true ? Validation<BehaviorMonad<A>> : BehaviorMonad<A>;

export const BehaviorMonadTrait = {
  map,
  of,
  chain,
  run,
};
