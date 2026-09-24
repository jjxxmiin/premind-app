describe('Checkbox web accessibility', () => {
  it('reflects its checked state on the checkbox DOM node', () => {
    // `doMock` is deliberately scoped after the Expo preset has initialized;
    // a hoisted web mock would make that native preset probe browser modules.
    jest.doMock('lucide-react-native', () => ({ Check: () => null }));
    jest.doMock('react-native', () => ({
      ...jest.requireActual('react-native-web'),
      // expo-modules-core may be pulled in while React DOM snapshots the
      // global object. RNW has no native registry, so model the empty web one.
      TurboModuleRegistry: { get: () => null },
    }));
    // `react-dom` is an Expo runtime dependency, but this workspace intentionally
    // does not ship its declaration package because production code never imports it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderToStaticMarkup } = require('react-dom/server') as {
      renderToStaticMarkup: (node: React.ReactNode) => string;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Checkbox } = require('./Checkbox') as typeof import('./Checkbox');

    const checkedMarkup = renderToStaticMarkup(
      <Checkbox checked label="약관에 동의" onChange={() => undefined} />,
    );
    const uncheckedMarkup = renderToStaticMarkup(
      <Checkbox
        checked={false}
        label="약관에 동의"
        onChange={() => undefined}
      />,
    );

    expect(checkedMarkup.match(/role="checkbox"/g)).toHaveLength(1);
    expect(checkedMarkup).toContain('aria-checked="true"');
    expect(uncheckedMarkup.match(/role="checkbox"/g)).toHaveLength(1);
    expect(uncheckedMarkup).toContain('aria-checked="false"');
  });
});
