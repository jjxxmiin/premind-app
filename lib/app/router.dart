import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/widgets/app_wordmark.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/splash_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/lectures/presentation/lecture_detail_screen.dart';
import '../features/lectures/presentation/lectures_screen.dart';
import '../features/processing/presentation/processing_screen.dart';
import '../features/profile/presentation/profile_screen.dart';
import '../features/recording/presentation/lecture_setup_sheet.dart';
import '../features/recording/presentation/recording_complete_screen.dart';
import '../features/recording/presentation/recording_screen.dart';
import '../features/recording/presentation/recording_state.dart';
import '../features/sharing/presentation/lecture_share_sheet.dart';
import '../features/sharing/presentation/sharing_screen.dart';
import 'app_navigation_scaffold.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        name: 'splash',
        builder: (context, state) => SplashScreen(
          onAuthenticated: () => context.goNamed('home'),
          onUnauthenticated: () => context.goNamed('login'),
        ),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) =>
            LoginScreen(onLoginSuccess: () => context.goNamed('home')),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppNavigationScaffold(
            currentIndex: navigationShell.currentIndex,
            onDestinationSelected: (index) {
              navigationShell.goBranch(
                index,
                initialLocation: index == navigationShell.currentIndex,
              );
            },
            child: navigationShell,
          );
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                name: 'home',
                builder: (context, state) => HomeScreen(
                  onStartRecording: () =>
                      unawaited(_openRecordingSetup(context)),
                  onVideoTap: () => _showVideoComingSoon(context),
                  onLectureTap: (lectureId) => context.pushNamed(
                    'lecture-detail',
                    pathParameters: {'lectureId': lectureId},
                  ),
                  onRecoverLecture: (lectureId) => context.pushNamed(
                    'processing',
                    pathParameters: {'lectureId': lectureId},
                  ),
                  onSeeAllLectures: () => context.goNamed('lectures'),
                  onProfileTap: () => context.goNamed('profile'),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/lectures',
                name: 'lectures',
                builder: (context, state) => LecturesScreen(
                  onLectureTap: (lectureId) => context.pushNamed(
                    'lecture-detail',
                    pathParameters: {'lectureId': lectureId},
                  ),
                  onStartRecording: () =>
                      unawaited(_openRecordingSetup(context)),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/sharing',
                name: 'sharing',
                builder: (context, state) => SharingScreen(
                  onLectureTap: (lectureId) => context.pushNamed(
                    'lecture-detail',
                    pathParameters: {'lectureId': lectureId},
                  ),
                  onBrowseLectures: () => context.goNamed('lectures'),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                name: 'profile',
                builder: (context, state) => ProfileScreen(
                  onLogout: () => unawaited(_logout(context, ref)),
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/recording',
        name: 'recording',
        builder: (context, state) {
          final title = state.extra is String
              ? state.extra! as String
              : state.uri.queryParameters['title'] ?? '새 강의';
          return RecordingScreen(title: title);
        },
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/recording/complete',
        name: 'recording-complete',
        redirect: (context, state) =>
            state.extra is RecordingState ? null : '/home',
        builder: (context, state) =>
            RecordingCompleteScreen(recording: state.extra! as RecordingState),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/processing/:lectureId',
        name: 'processing',
        builder: (context, state) =>
            ProcessingScreen(lectureId: state.pathParameters['lectureId']!),
      ),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/lecture/:lectureId',
        name: 'lecture-detail',
        builder: (context, state) => LectureDetailScreen(
          lectureId: state.pathParameters['lectureId']!,
          onShare: () => unawaited(
            showLectureShareSheet(
              context,
              lectureId: state.pathParameters['lectureId']!,
            ),
          ),
          showCompletionMessage: state.extra == true,
          onRetryProcessing: () => context.pushNamed(
            'processing',
            pathParameters: {'lectureId': state.pathParameters['lectureId']!},
          ),
        ),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const AppWordmark(height: 22)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.explore_off_outlined, size: 48),
              const SizedBox(height: 16),
              const Text('요청한 화면을 찾을 수 없어요.'),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () => context.goNamed('home'),
                child: const Text('홈으로'),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  ref.onDispose(router.dispose);
  return router;
});

Future<void> _openRecordingSetup(BuildContext context) async {
  final title = await showLectureSetupSheet(context);
  if (!context.mounted || title == null) {
    return;
  }
  context.pushNamed('recording', extra: title);
}

Future<void> _logout(BuildContext context, Ref ref) async {
  try {
    await ref.read(authControllerProvider.notifier).signOut();
    if (context.mounted) {
      context.goNamed('login');
    }
  } catch (_) {
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('로그아웃하지 못했어요. 다시 시도해 주세요.')));
  }
}

void _showVideoComingSoon(BuildContext context) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(const SnackBar(content: Text('강의 녹화는 준비 중입니다.')));
}
