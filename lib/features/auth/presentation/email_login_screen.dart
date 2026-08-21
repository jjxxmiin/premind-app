import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:premind/core/constants/app_sizes.dart';
import 'package:premind/core/constants/app_strings.dart';
import 'package:premind/core/network/api_client.dart';
import 'package:premind/core/widgets/app_button.dart';
import 'package:premind/features/auth/presentation/auth_controller.dart';

/// Email/password sign-in against the PREMIND API.
class EmailLoginScreen extends ConsumerStatefulWidget {
  const EmailLoginScreen({required this.onLoginSuccess, super.key});

  final VoidCallback onLoginSuccess;

  @override
  ConsumerState<EmailLoginScreen> createState() => _EmailLoginScreenState();
}

class _EmailLoginScreenState extends ConsumerState<EmailLoginScreen> {
  static final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (!_emailPattern.hasMatch(email)) {
      return AppStrings.emailInvalidError;
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) {
      return AppStrings.passwordEmptyError;
    }
    return null;
  }

  String _messageFor(Object error) {
    if (error is ApiException) {
      if (error.isNetworkError) {
        return AppStrings.loginFailedNetwork;
      }
      return switch (error.statusCode) {
        401 || 403 => AppStrings.loginFailedCredentials,
        429 => AppStrings.loginFailedRateLimited,
        _ => AppStrings.loginFailedUnknown,
      };
    }
    return AppStrings.loginFailedUnknown;
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }
    FocusScope.of(context).unfocus();

    try {
      await ref
          .read(authControllerProvider.notifier)
          .signInWithEmail(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) {
        return;
      }
      // Commit the autofill context so password managers offer to save the
      // credentials that just signed in successfully.
      TextInput.finishAutofillContext();
      widget.onLoginSuccess();
    } on Object catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(_messageFor(error))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isLoading = ref.watch(authControllerProvider).isLoading;

    return Scaffold(
      appBar: AppBar(
        // Entered directly (deep link, web URL) this route is the whole
        // stack, so only offer a back button when there is a route to pop.
        leading: Navigator.of(context).canPop()
            ? IconButton(
                onPressed: () => context.pop(),
                tooltip: '뒤로 가기',
                icon: const Icon(Icons.arrow_back_rounded),
              )
            : null,
        title: const Text(AppStrings.emailLoginTitle),
        centerTitle: true,
      ),
      // Fields scroll from the top while the submit button stays on the
      // bottom edge: the form keeps two anchors instead of floating above
      // half a screen of nothing, and the button rides above the keyboard.
      body: SafeArea(
        // Top-aligned: the fields belong under the title, not floating in the
        // middle, and the keyboard will claim the lower half anyway.
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: AppSizes.contentMaxWidth,
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSizes.pagePadding,
                AppSizes.space24,
                AppSizes.pagePadding,
                AppSizes.space24,
              ),
              child: Form(
                key: _formKey,
                autovalidateMode: AutovalidateMode.disabled,
                child: AutofillGroup(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          AppStrings.emailLoginDescription,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: AppSizes.space24),
                        Text(
                          AppStrings.emailFieldLabel,
                          style: theme.textTheme.labelLarge,
                        ),
                        const SizedBox(height: AppSizes.space8),
                        TextFormField(
                          controller: _emailController,
                          enabled: !isLoading,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          autocorrect: false,
                          textInputAction: TextInputAction.next,
                          validator: _validateEmail,
                          decoration: const InputDecoration(
                            hintText: AppStrings.emailFieldHint,
                          ),
                        ),
                        const SizedBox(height: AppSizes.space20),
                        Text(
                          AppStrings.passwordFieldLabel,
                          style: theme.textTheme.labelLarge,
                        ),
                        const SizedBox(height: AppSizes.space8),
                        TextFormField(
                          controller: _passwordController,
                          enabled: !isLoading,
                          obscureText: _obscurePassword,
                          autofillHints: const [AutofillHints.password],
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _submit(),
                          validator: _validatePassword,
                          decoration: InputDecoration(
                            hintText: AppStrings.passwordFieldHint,
                            suffixIcon: IconButton(
                              onPressed: () => setState(
                                () => _obscurePassword = !_obscurePassword,
                              ),
                              tooltip: _obscurePassword
                                  ? '비밀번호 표시'
                                  : '비밀번호 숨기기',
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(
          AppSizes.pagePadding,
          0,
          AppSizes.pagePadding,
          AppSizes.space20,
        ),
        child: AppButton(
          label: AppStrings.login,
          isLoading: isLoading,
          onPressed: _submit,
        ),
      ),
    );
  }
}
