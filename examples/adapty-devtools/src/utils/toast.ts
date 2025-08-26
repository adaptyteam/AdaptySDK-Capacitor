import { Toast } from '@capacitor/toast';

interface ToastOptions {
  text: string;
  duration?: 'short' | 'long';
  position?: 'top' | 'center' | 'bottom';
}

const showToast = async (options: ToastOptions) => {
  return await Toast.show({
    text: options.text,
    duration: options.duration || 'short',
    position: options.position || 'top',
  });
};

export const showSuccessToast = async (text: string, options?: Partial<Omit<ToastOptions, 'text'>>) => {
  return await showToast({ text, duration: 'short', ...options });
};

export const showErrorToast = async (text: string, options?: Partial<Omit<ToastOptions, 'text'>>) => {
  return await showToast({ text, duration: 'long', ...options });
};
