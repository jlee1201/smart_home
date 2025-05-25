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
          <Link to="/" className="farmhouse-logo">
            <h1>Smart Home</h1>
          </Link>
          <nav className="farmhouse-nav header-nav">
            <Link to="/vizio-remote" className="farmhouse-nav-link">TV Remote</Link>
            <Link to="/denon-avr-remote" className="farmhouse-nav-link">AVR Remote</Link>
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