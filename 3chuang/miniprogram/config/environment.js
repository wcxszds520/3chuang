'use strict';

const API_BASE_URLS = Object.freeze({
  develop: 'http://127.0.0.1:3000/api',
  trial: '',
  release: ''
});

function getEnvironmentVersion() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || 'develop';
  } catch (error) {
    return 'develop';
  }
}

function getApiBaseUrl() {
  const override = wx.getStorageSync('apiBaseUrl');
  if (typeof override === 'string' && /^https?:\/\//.test(override)) return override.replace(/\/$/, '');
  return API_BASE_URLS[getEnvironmentVersion()] || '';
}

module.exports = { API_BASE_URLS, getApiBaseUrl, getEnvironmentVersion };
