import axios from 'axios';
import toast from 'react-hot-toast';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Đã xảy ra lỗi kết nối máy chủ';
    toast.error(message);
    return Promise.reject(error);
  }
);
