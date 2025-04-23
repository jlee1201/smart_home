import React from 'react';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  return (
    <div className="farmhouse-layout">
      <header>
        <div className="farmhouse-container">
          <h1>Smart Home</h1>
          <nav className="farmhouse-nav header-nav">
            <Link to="/" className="farmhouse-nav-link">Home</Link>
            <Link to="/input" className="farmhouse-nav-link">Input</Link>
          </nav>
        </div>
      </header>
      
      <main>
        <div className="farmhouse-container">
          {title && (
            <div className="section-title">
              <h2>{title}</h2>
              <div className="accent-bar"></div>
            </div>
          )}
          
          {children}
        </div>
      </main>
      
      <footer>
        <div className="farmhouse-container">
          <p>© {new Date().getFullYear()} Smart Home - Modern Farmhouse</p>
        </div>
      </footer>
    </div>
  );
}; 