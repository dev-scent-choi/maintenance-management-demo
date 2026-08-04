import toast from 'react-hot-toast';

export const useToast = () => {
  return {
    success: (message: string) => {
      const toastId = toast.custom(
        (t) => (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              toast.dismiss(t.id);
            }}
            style={{
              background: '#10B981',
              color: '#fff',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              userSelect: 'none',
              transition: 'all 0.2s ease-out',
              opacity: t.visible ? 1 : 0,
              transform: t.visible ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z" fill="white"/>
            </svg>
            <span style={{ whiteSpace: 'nowrap' }}>{message}</span>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toast.dismiss(t.id);
              }}
              style={{
                flexShrink: 0,
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                marginLeft: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 1L1 11M1 1L11 11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ),
        { duration: 3000, position: 'bottom-right', style: { margin: '8px 0' } }
      );
      return toastId;
    },
    error: (message: string) => {
      const toastId = toast.custom(
        (t) => (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              toast.dismiss(t.id);
            }}
            style={{
              background: '#EF4444',
              color: '#fff',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              userSelect: 'none',
              transition: 'all 0.2s ease-out',
              opacity: t.visible ? 1 : 0,
              transform: t.visible ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="white"/>
            </svg>
            <span style={{ whiteSpace: 'nowrap' }}>{message}</span>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toast.dismiss(t.id);
              }}
              style={{
                flexShrink: 0,
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                marginLeft: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 1L1 11M1 1L11 11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        ),
        { duration: 4000, position: 'bottom-right', style: { margin: '8px 0' } }
      );
      return toastId;
    },
    loading: (message: string) => {
      return toast.custom(
        (t) => (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              toast.dismiss(t.id);
            }}
            style={{
              background: '#3B82F6',
              color: '#fff',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              userSelect: 'none',
              transition: 'all 0.2s ease-out',
              opacity: t.visible ? 1 : 0,
              transform: t.visible ? 'translateY(0)' : 'translateY(10px)',
            }}
          >
            <div style={{
              width: '20px',
              height: '20px',
              border: '4px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <span style={{ whiteSpace: 'nowrap' }}>{message}</span>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toast.dismiss(t.id);
              }}
              style={{
                flexShrink: 0,
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                marginLeft: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 1L1 11M1 1L11 11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ),
        { duration: Infinity, position: 'bottom-right', style: { margin: '8px 0' } }
      );
    },
    promise: <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string;
        error: string;
      }
    ) => {
      return toast.promise(
        promise,
        {
          loading: messages.loading,
          success: messages.success,
          error: messages.error,
        },
        {
          position: 'bottom-right',
          style: {
            padding: '16px 24px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer',
            marginBottom: '10px',
            whiteSpace: 'nowrap' as const,
          },
        }
      );
    },
    dismiss: (toastId?: string) => {
      toast.dismiss(toastId);
    },
  };
};
