import React, { useState, useEffect } from 'react';
import { getInitials } from '../utils/storage';

// In-memory cache of verified loaded avatar URLs for 0ms instant re-renders across pages
const verifiedLoadedUrls = new Set<string>();
const brokenUrls = new Set<string>();

interface FastMemberAvatarProps {
  src?: string;
  name: string;
  className?: string;
  initialsClassName?: string;
}

export const FastMemberAvatar: React.FC<FastMemberAvatarProps> = React.memo(({
  src,
  name,
  className = 'w-14 h-18 sm:w-16 sm:h-20 rounded-xl',
  initialsClassName = 'text-base sm:text-lg',
}) => {
  const cleanSrc = (src || '').trim();
  const isAlreadyVerified = cleanSrc.length > 0 && verifiedLoadedUrls.has(cleanSrc);
  const isKnownBroken = !cleanSrc || brokenUrls.has(cleanSrc);

  const [hasError, setHasError] = useState<boolean>(isKnownBroken);
  const [isLoaded, setIsLoaded] = useState<boolean>(isAlreadyVerified || cleanSrc.startsWith('data:image/'));

  useEffect(() => {
    const nextSrc = (src || '').trim();
    if (!nextSrc || brokenUrls.has(nextSrc)) {
      setHasError(true);
      setIsLoaded(false);
    } else {
      setHasError(false);
      setIsLoaded(verifiedLoadedUrls.has(nextSrc) || nextSrc.startsWith('data:image/'));
    }
  }, [src]);

  const initials = getInitials(name);

  return (
    <div
      className={`${className} overflow-hidden bg-[#0b5d34] border-2 border-[#0b5d34] flex items-center justify-center shrink-0 shadow-xs relative select-none`}
    >
      {/* Initials fallback always ready underneath so there is 0ms blank/broken state */}
      {(!isLoaded || hasError) && (
        <div
          className={`w-full h-full bg-[#0b5d34] text-white flex items-center justify-center font-bold ${initialsClassName}`}
        >
          {initials}
        </div>
      )}

      {cleanSrc && !hasError && (
        <img
          src={cleanSrc}
          alt={name}
          decoding="async"
          loading="eager"
          onLoad={() => {
            verifiedLoadedUrls.add(cleanSrc);
            setIsLoaded(true);
          }}
          onError={() => {
            brokenUrls.add(cleanSrc);
            setHasError(true);
          }}
          className={`w-full h-full object-cover transition-opacity duration-150 ${
            isLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
          }`}
        />
      )}
    </div>
  );
});
