import { useEffect } from 'react';

/**
 * Custom hook that listens for the Escape keypress event and calls a callback function.
 * @param {Function} callback - Function to run when Escape is pressed.
 * @param {boolean} active - Hook only active when this is true (e.g. if the modal is open).
 */
export const useEscapeKey = (callback, active = true) => {
    useEffect(() => {
        if (!active || !callback) return;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                callback();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [callback, active]);
};

export default useEscapeKey;
