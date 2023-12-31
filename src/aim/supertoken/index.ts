import supertokens from 'supertokens-node';
import { ProviderInput } from 'supertokens-node/lib/build/recipe/thirdparty/types';
import Session from 'supertokens-node/recipe/session';
import ThirdParty from 'supertokens-node/recipe/thirdparty';
import ThirdPartyPasswordless from 'supertokens-node/recipe/thirdpartypasswordless';
import Dashboard from 'supertokens-node/recipe/dashboard';
import { Option, pipe } from '@logic/fp';
import { match } from 'ts-pattern';

export enum RECIPE {
  SOCIAL_LOGIN = 'SOCIAL_LOGIN',
  SOCIAL_LOGIN_PASSWORDLESS_OPT_EMAIL_PHONE = 'SOCIAL_LOGIN_PASSWORDLESS_OPT_EMAIL_PHONE',
}

export enum FRAMEWORK {
  NEST = 'NEST',
  EXPRESS = 'EXPRESS',
}

interface InitParam {
  spInstanceUri: string;
  appId: Option.Option<string>;
  appName: string;
  apiDomain: string;
  websiteDomain: string;
  apiBasePath: Option.Option<string>;
  websiteBasePath: Option.Option<string>;
  apiKey: string;
  providers: ProviderInput[];
  hasDashboard: boolean;
  recipe: RECIPE;
  framework: FRAMEWORK;
}

export const init = (params: InitParam) => {
  const recipeList = match(params.recipe)
    .with(RECIPE.SOCIAL_LOGIN, () => [
      ThirdParty.init({
        signInAndUpFeature: {
          providers: params.providers,
        },
      }),
    ])
    .with(RECIPE.SOCIAL_LOGIN_PASSWORDLESS_OPT_EMAIL_PHONE, () => [
      ThirdPartyPasswordless.init({
        flowType: 'USER_INPUT_CODE',
        contactMethod: 'EMAIL_OR_PHONE',
        providers: params.providers,
      }),
    ])
    .exhaustive();

  const frameworkConf = match(params.framework)
    .with(FRAMEWORK.NEST, () => ({}))
    .with(FRAMEWORK.EXPRESS, () => ({
      framework: 'express',
    }))
    .exhaustive();

  return supertokens.init({
    ...frameworkConf,
    supertokens: {
      // https://try.supertokens.com is for demo purposes. Replace this with the address of your core instance (sign up on supertokens.com), or self host a core.
      connectionURI: pipe(
        params.appId,
        Option.fold(
          () => params.spInstanceUri,
          (appId) => `${params.spInstanceUri}$/appid-${appId}`,
        ),
      ),
      apiKey: params.apiKey,
    },
    appInfo: {
      // learn more about this on https://supertokens.com/docs/session/appinfo
      appName: params.appName,
      apiDomain: params.apiDomain,
      websiteDomain: params.websiteDomain,
      apiBasePath: pipe(
        params.apiBasePath,
        Option.getOrElse(() => '/auth'),
      ),
      websiteBasePath: pipe(
        params.websiteBasePath,
        Option.getOrElse(() => '/auth'),
      ),
    },
    recipeList: [
      ...recipeList,
      Session.init(), // initializes session features
    ].concat(params.hasDashboard ? [Dashboard.init()] : []),
  });
};
