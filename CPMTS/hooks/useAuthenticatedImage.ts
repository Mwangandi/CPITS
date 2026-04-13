import { useState, useEffect } from 'react';
import { fetchAuthenticatedImageUrl } from '../services/frappeAPI';

/**
 * Hook that resolves a Frappe file URL (including private files) to a displayable URL.
 * For private files, fetches with auth headers and returns a blob URL.
 */
export function useAuthenticatedImage(imageUrl: string | undefined): string {
    const [resolvedUrl, setResolvedUrl] = useState('');

    useEffect(() => {
        if (!imageUrl) {
            setResolvedUrl('');
            return;
        }

        // External URLs or blob URLs don't need auth
        if (imageUrl.startsWith('http') || imageUrl.startsWith('blob:')) {
            setResolvedUrl(imageUrl);
            return;
        }

        let cancelled = false;
        fetchAuthenticatedImageUrl(imageUrl).then(url => {
            if (!cancelled) setResolvedUrl(url);
        });
        return () => { cancelled = true; };
    }, [imageUrl]);

    return resolvedUrl;
}
