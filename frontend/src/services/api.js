import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = {
  compileAndRun: async (code) => {
    try {
      const response = await axios.post(`${API_URL}/compile`, { code });
      return response.data;
    } catch (error) {
      if (error.response) {
        return {
          success: false,
          error: error.response.data.error || 'Error compiling code',
          output: error.response.data.output || ''
        };
      }
      return {
        success: false,
        error: 'Network error: Unable to connect to server',
        output: ''
      };
    }
  },

  getReference: async () => {
    try {
      const response = await axios.get(`${API_URL}/reference`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch language reference');
    }
  }
};

export default api;