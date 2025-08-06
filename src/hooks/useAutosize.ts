import { useEffect, useRef } from 'react';

export function useAutosize<T extends HTMLTextAreaElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = 'auto';
      const newHeight = Math.min(
        textarea.scrollHeight,
        window.innerHeight * 0.4 // 40% of viewport height
      );
      textarea.style.height = `${newHeight}px`;
    };

    // Initial adjustment
    adjustHeight();

    // Adjust on input
    textarea.addEventListener('input', adjustHeight);
    
    // Adjust on window resize
    window.addEventListener('resize', adjustHeight);

    return () => {
      textarea.removeEventListener('input', adjustHeight);
      window.removeEventListener('resize', adjustHeight);
    };
  }, []);

  return ref;
}
