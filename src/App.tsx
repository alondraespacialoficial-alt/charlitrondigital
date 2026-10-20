import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { BlogListPage } from './features/blog/BlogListPage';
import { BlogPostPage } from './features/blog/BlogPostPage';
import { AdminApp } from './features/admin/AdminApp';
import { AgencyHubPage } from './features/btl/AgencyHubPage';
import { BtlServicePage } from './features/btl/BtlServicePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/agencia" element={<AgencyHubPage />} />
        <Route path="/agencia/:slug" element={<BtlServicePage />} />
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

