import { useEffect, useRef } from 'react';

/**
 * Custom hook that listens for the Escape keypress event and calls a callback function.
 * @param {Function} callback - Function to run when Escape is pressed.
 * @param {boolean} active - Hook only active when this is true (e.g. if the modal is open).
 */
export const useEscapeKey = (callback, active = true) => {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        if (!active) return;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
                callbackRef.current?.(event);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [active]);
};

export default useEscapeKey;

