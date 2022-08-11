export const Success = (message, code, data = []) => ({
  status: 'success',
  message,
  code,
  data,
});

export const Error = (message, code) => ({
  status: 'error',
  message,
  code,
  data: null,
});

export const successResponse = (res, message, code, data = []) => {
  res.status(code).json({
    status: 'success',
    message,
    code,
    data,
  });
};
