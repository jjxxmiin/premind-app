import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:premind/features/upload/presentation/upload_providers.dart';

import 'router.dart';
import 'theme.dart';

class PremindApp extends ConsumerStatefulWidget {
  const PremindApp({super.key});

  @override
  ConsumerState<PremindApp> createState() => _PremindAppState();
}

class _PremindAppState extends ConsumerState<PremindApp> {
  AppLifecycleListener? _lifecycleListener;

  @override
  void initState() {
    super.initState();
    // Recordings queued on a dead network — or left behind by a crash — are
    // pushed on launch and every time the app comes back to the foreground.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      try {
        final driver = ref.read(uploadDriverProvider);
        _lifecycleListener = AppLifecycleListener(
          onResume: driver.handleResumed,
        );
        driver.drain();
      } on Object catch (error, stackTrace) {
        // Uploading is best-effort background work: if the queue cannot even
        // be wired up, the recorder still has to launch.
        FlutterError.reportError(
          FlutterErrorDetails(
            exception: error,
            stack: stackTrace,
            library: 'premind',
            context: ErrorDescription('starting the upload queue'),
            silent: true,
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _lifecycleListener?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'PREMIND',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: router,
      locale: const Locale('ko'),
      supportedLocales: const [Locale('ko')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}
