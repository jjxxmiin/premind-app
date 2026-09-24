import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS?.trim();
  // Android autolinks the SDK without Firebase. The plugin only needs to add
  // the iOS callback scheme once an actual iOS OAuth client has been created.
  const plugins = [...(config.plugins ?? [])];
  if (iosClientId?.endsWith('.apps.googleusercontent.com')) {
    plugins.push(['@react-native-google-signin/google-signin', {
      iosUrlScheme: `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`,
    }]);
  }
  return { ...config, name: config.name ?? 'PREMIND', slug: config.slug ?? 'premind', plugins };
};
