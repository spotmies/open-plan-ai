import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary';
import { logger } from '@/services/monitoring/logger';

// Mock the logger
vi.mock('@/services/monitoring/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Component that throws an error
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

// Component that works normally
const WorkingComponent = () => <div>Component is working</div>;

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error for expected errors in tests
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  describe('normal operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <WorkingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Component is working')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should catch errors and display fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should display the error message', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('should display recovery instructions', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
    });

    it('should log the error', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(logger.error).toHaveBeenCalledWith(
        'React Error Boundary caught error',
        expect.objectContaining({
          error: 'Test error message',
        })
      );
    });
  });

  describe('recovery actions', () => {
    it('should render Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('should render Go Home button', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: /Go Home/i })).toBeInTheDocument();
    });

    it('should reset error state when Try Again is clicked', async () => {
      const user = userEvent.setup();
      let shouldThrow = true;
      
      const ToggleComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Recovered</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <ToggleComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Change state so component won't throw on re-render
      shouldThrow = false;

      await user.click(screen.getByRole('button', { name: 'Try Again' }));

      // Force re-render to check if state was reset
      rerender(
        <ErrorBoundary>
          <WorkingComponent />
        </ErrorBoundary>
      );

      // The component should try to render children again
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should navigate home when Go Home is clicked', async () => {
      const user = userEvent.setup();
      Object.defineProperty(window, 'location', {
        value: { href: 'http://localhost/some-page', reload: vi.fn() },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      await user.click(screen.getByRole('button', { name: /Go Home/i }));

      expect(window.location.href).toBe('/');
    });
  });

  describe('custom fallback', () => {
    it('should render custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error message</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should render custom fallback component', () => {
      const CustomFallback = () => (
        <div>
          <h1>Oops!</h1>
          <p>Custom error handling</p>
        </div>
      );

      render(
        <ErrorBoundary fallback={<CustomFallback />}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops!')).toBeInTheDocument();
      expect(screen.getByText('Custom error handling')).toBeInTheDocument();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const WrappedComponent = withErrorBoundary(WorkingComponent);
      
      render(<WrappedComponent />);

      expect(screen.getByText('Component is working')).toBeInTheDocument();
    });

    it('should catch errors in wrapped component', () => {
      const WrappedThrowingComponent = withErrorBoundary(ThrowingComponent);
      
      render(<WrappedThrowingComponent />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should use custom fallback when provided', () => {
      const WrappedThrowingComponent = withErrorBoundary(
        ThrowingComponent,
        <div>HOC Custom Fallback</div>
      );
      
      render(<WrappedThrowingComponent />);

      expect(screen.getByText('HOC Custom Fallback')).toBeInTheDocument();
    });

    it('should pass props to wrapped component', () => {
      const ComponentWithProps = ({ message }: { message: string }) => (
        <div>{message}</div>
      );
      const WrappedComponent = withErrorBoundary(ComponentWithProps);
      
      render(<WrappedComponent message="Hello from props" />);

      expect(screen.getByText('Hello from props')).toBeInTheDocument();
    });
  });

  describe('error info capture', () => {
    it('should capture component stack in error info', () => {
      render(
        <ErrorBoundary>
          <div>
            <ThrowingComponent />
          </div>
        </ErrorBoundary>
      );

      expect(logger.error).toHaveBeenCalledWith(
        'React Error Boundary caught error',
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('nested error boundaries', () => {
    it('should catch error at nearest boundary', () => {
      render(
        <ErrorBoundary fallback={<div>Outer boundary</div>}>
          <div>
            <ErrorBoundary fallback={<div>Inner boundary</div>}>
              <ThrowingComponent />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Inner boundary')).toBeInTheDocument();
      expect(screen.queryByText('Outer boundary')).not.toBeInTheDocument();
    });
  });
});
