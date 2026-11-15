import React from 'react';

export function isImageAvatar(avatar?: string | null): boolean {
  if (!avatar) return false;
  const trimmed = avatar.trim();
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  );
}

interface PlayerAvatarProps {
  avatar?: string | null;
  alt?: string;
  fill?: boolean;
  className?: string;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  avatar,
  alt = '',
  fill = false,
  className = '',
}) => {
  const value = avatar?.trim() || '🐸';

  if (isImageAvatar(value)) {
    return (
      <img
        src={value}
        alt={alt}
        draggable={false}
        className={
          fill
            ? `w-full h-full object-cover rounded-[inherit] block select-none ${className}`
            : `inline-block w-[1.25em] h-[1.25em] rounded-full object-cover align-middle shrink-0 border border-white/25 select-none ${className}`
        }
      />
    );
  }

  return className ? <span className={className}>{value}</span> : <>{value}</>;
};
