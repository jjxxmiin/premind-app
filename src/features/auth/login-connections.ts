import { apiClient, type AuthProvider, type KakaoCodeProof, type LoginMethod } from '@/services/api/client';
import { sessionManager } from '@/services/api/session-manager';

// A provider popup may outlive the session that opened it. Never attach its
// identity to a different account that signed in on this device meanwhile.
function forAccount<T>(userId: string, operation: (token: string) => Promise<T>): Promise<T> {
  return sessionManager.authorize((token) => {
    if (!userId || sessionManager.session?.user.id !== userId) {
      throw new Error('로그인한 계정이 바뀌었어요. 연결을 다시 시도해 주세요.');
    }
    return operation(token);
  });
}

export const loginConnections = {
  list: (userId: string) => forAccount(userId, (token) => apiClient.getLoginConnections(token)),
  link: (userId: string, provider: AuthProvider, credential: string, proof?: KakaoCodeProof) =>
    forAccount(userId, (token) => apiClient.linkLoginConnection(token, provider, credential, proof)),
  addEmail: (userId: string, password: string) => forAccount(userId, (token) => apiClient.addEmailLogin(token, password)),
  unlink: (userId: string, provider: LoginMethod) => forAccount(userId, (token) => apiClient.unlinkLoginConnection(token, provider)),
};
