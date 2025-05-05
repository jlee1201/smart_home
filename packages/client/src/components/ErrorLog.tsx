import React, { useEffect, useState } from 'react';
import { gql, useQuery, useSubscription, useMutation } from '@apollo/client';
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

const CLEAR_ERROR_LOGS_MUTATION = gql`
  mutation ClearErrorLogs {
    clearErrorLogs
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

  // Mutation to clear error logs
  const [clearErrorLogs, { loading: clearingLogs }] = useMutation(CLEAR_ERROR_LOGS_MUTATION, {
    onError: (error) => {
      console.error('Error clearing logs:', error);
    }
  });
  
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

  // Handle clear logs
  const handleClearLogs = () => {
    clearErrorLogs();
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
        <div className="error-log-header">
          <button 
            onClick={handleClearLogs} 
            className="error-log-clear-button"
            disabled={clearingLogs || errorLogs.length === 0}
          >
            {clearingLogs ? 'Clearing...' : 'Clear All'}
          </button>
        </div>
        
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