'use client';

import React, { useState, useEffect } from 'react';
import { useNotification } from '../Notification';

export function SettingsScreen() {
  const { showNotification } = useNotification();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:5000');

  useEffect(() => {
    // Load theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    if (newTheme) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const testConnection = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (response.ok) {
        showNotification('API connection successful!', 'success');
      } else {
        showNotification('API connection failed', 'error');
      }
    } catch (error) {
      showNotification('Connection failed: Network error', 'error');
      console.log(error);
    }
  };

  const downloadStatement = () => {
    showNotification('Statement download feature coming soon!', 'info');
  };

  const exportData = () => {
    showNotification('Data export feature coming soon!', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚙️</span>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Theme Settings */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Theme Preferences</h3>
          <p className="text-sm text-gray-600 mb-4">
            Customize your visual experience with light or dark mode
          </p>
          
          <div className="flex items-center gap-4">
            <span className="text-sm">🌞 Light</span>
            <button
              onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isDarkMode ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  isDarkMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm">🌙 Dark</span>
          </div>
        </div>

        {/* API Configuration */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">API Configuration</h3>
          <p className="text-sm text-gray-600 mb-4">
            Configure backend API connection
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="form-label">API Base URL</label>
              <input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="form-input"
                placeholder="http://localhost:5000"
              />
            </div>
            
            <button onClick={testConnection} className="btn-primary">
              Test Connection
            </button>
          </div>
        </div>

        {/* Account Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Actions</h3>
          <p className="text-sm text-gray-600 mb-4">
            Manage your account and data
          </p>
          
          <div className="flex flex-wrap gap-3">
            <button onClick={downloadStatement} className="btn-secondary">
              Download Statement
            </button>
            <button onClick={exportData} className="btn-secondary">
              Export Data
            </button>
          </div>
        </div>

        {/* About */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">About PesaFlow</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Build:</strong> Next.js + TypeScript</p>
            <p><strong>API:</strong> Node.js + Express + MongoDB</p>
            <p className="text-xs text-gray-500 pt-2">
              PesaFlow is a modern SACCO management platform designed for financial institutions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}