import React, { useEffect, useState } from 'react';
import { gql, useQuery, useSubscription } from '@apollo/client';
import { Collapsible } from '@design-system';

const ERROR_LOGS_QUERY = gql`
  query GetErrorLogs {
    errorLogs {
      id
      timestamp
      message
      details
    }
  }
`;

const ERROR_LOG_SUBSCRIPTION = gql`
  subscription OnErrorLogChanged {
    errorLogChanged {
      id
      timestamp
      message
      details
    }
  }
`;

type ErrorLog = {
  id: string;
  timestamp: number;
  message: string;
  details?: string;
};

export const ErrorLog: React.FC = () => {
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [hasNewErrors, setHasNewErrors] = useState(false);
  
  // Get initial error logs
  const { data: queryData } = useQuery(ERROR_LOGS_QUERY);
  
  // Subscribe to error log changes
  const { data: subscriptionData, error: subscriptionError } = useSubscription(
    ERROR_LOG_SUBSCRIPTION,
    {
      onError: (error) => {
        console.error('Error log subscription error:', error);
      }
    }
  );
  
  // Initialize from query
  useEffect(() => {
    if (queryData?.errorLogs) {
      setErrorLogs(queryData.errorLogs);
    }
  }, [queryData]);
  
  // Update from subscription
  useEffect(() => {
    if (subscriptionData?.errorLogChanged) {
      setErrorLogs(subscriptionData.errorLogChanged);
      setHasNewErrors(true);
      
      // Reset the new errors indicator after 5 seconds
      const timer = setTimeout(() => {
        setHasNewErrors(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [subscriptionData]);
  
  // Format timestamp
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // If no errors and no subscription error, don't render anything
  if (errorLogs.length === 0 && !subscriptionError) {
    return null;
  }
  
  return (
    <div className="error-log">
      <Collapsible
        title={
          <div className="flex items-center">
            <span className={hasNewErrors ? 'error-log-indicator' : ''}>
              {hasNewErrors ? '🔴 ' : ''}Error Log ({errorLogs.length})
            </span>
          </div>
        }
        className="error-log-collapsible"
        isOpen={hasNewErrors}
      >
        {subscriptionError && (
          <div className="error-log-item">
            <div className="error-log-time">Now</div>
            <div className="error-log-message">
              Error log subscription failed: {subscriptionError.message}
            </div>
          </div>
        )}
        
        {errorLogs.length === 0 ? (
          <div className="error-log-empty">No errors recorded yet.</div>
        ) : (
          errorLogs.map((log) => (
            <div key={log.id} className="error-log-item">
              <div className="error-log-time">{formatTime(log.timestamp)}</div>
              <div className="error-log-message">{log.message}</div>
              {log.details && (
                <details className="error-log-details">
                  <summary>Details</summary>
                  <pre>{log.details}</pre>
                </details>
              )}
            </div>
          ))
        )}
      </Collapsible>
    </div>
  );
}; 