// Reads the API's { success: false, error: { code, message } } out of an axios error.

export function getErrorMessage(error) {
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  if (error?.response) return `Request failed (${error.response.status})`;
  if (error?.request) return 'Cannot reach the server. Check your connection and try again.';
  return error?.message || 'Something went wrong. Please try again.';
}

export function getErrorCode(error) {
  return error?.response?.data?.error?.code;
}
