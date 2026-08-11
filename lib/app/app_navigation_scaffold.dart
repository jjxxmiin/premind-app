import 'package:flutter/material.dart';
import 'package:premind/core/constants/app_strings.dart';

/// Shared four-destination navigation shell used by the application router.
class AppNavigationScaffold extends StatelessWidget {
  const AppNavigationScaffold({
    required this.child,
    required this.currentIndex,
    required this.onDestinationSelected,
    super.key,
  }) : assert(currentIndex >= 0 && currentIndex < 4);

  final Widget child;
  final int currentIndex;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      body: child,
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          color: colorScheme.surface,
          border: Border(
            top: BorderSide(color: colorScheme.outlineVariant, width: 0.8),
          ),
        ),
        child: NavigationBarTheme(
          data: theme.navigationBarTheme.copyWith(
            height: 68,
            elevation: 0,
            backgroundColor: colorScheme.surface,
            indicatorColor: Colors.transparent,
            labelTextStyle: WidgetStateProperty.resolveWith((states) {
              final selected = states.contains(WidgetState.selected);
              return theme.textTheme.labelSmall?.copyWith(
                color: selected
                    ? colorScheme.primary
                    : colorScheme.onSurfaceVariant,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              );
            }),
            iconTheme: WidgetStateProperty.resolveWith((states) {
              final selected = states.contains(WidgetState.selected);
              return IconThemeData(
                color: selected
                    ? colorScheme.primary
                    : colorScheme.onSurfaceVariant,
                size: 23,
              );
            }),
          ),
          child: NavigationBar(
            selectedIndex: currentIndex,
            onDestinationSelected: onDestinationSelected,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: _SelectedNavigationIcon(Icons.home_rounded),
                label: AppStrings.home,
              ),
              NavigationDestination(
                icon: Icon(Icons.library_books_outlined),
                selectedIcon: _SelectedNavigationIcon(
                  Icons.library_books_rounded,
                ),
                label: AppStrings.lectures,
              ),
              NavigationDestination(
                icon: Icon(Icons.link_outlined),
                selectedIcon: _SelectedNavigationIcon(Icons.link_rounded),
                label: AppStrings.sharing,
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: _SelectedNavigationIcon(Icons.person_rounded),
                label: AppStrings.myPage,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectedNavigationIcon extends StatelessWidget {
  const _SelectedNavigationIcon(this.icon);

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 32,
      height: 28,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          Icon(icon),
          Positioned(
            bottom: 0,
            child: Container(
              width: 18,
              height: 2,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
