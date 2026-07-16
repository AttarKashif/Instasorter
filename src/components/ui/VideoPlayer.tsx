import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface VideoPlayerProps {
  src: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, src]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      setProgress(
        (videoRef.current.currentTime / videoRef.current.duration) * 100,
      );
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && videoRef.current.duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const seekTime = (clickX / width) * videoRef.current.duration;
      videoRef.current.currentTime = seekTime;
    }
  };

  return (
    <div
      id="video-container"
      className="relative w-full h-full bg-black group/video flex items-center justify-center"
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        loop
        playsInline
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onClick={() => setIsPlaying(!isPlaying)}
      />

      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
            <Play size={24} fill="currentColor" />
          </div>
        </div>
      )}

      {/* Video controls bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity duration-300 flex flex-col gap-2 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Timeline */}
        <div
          onClick={handleTimelineClick}
          className="h-1.5 w-full bg-white/30 rounded-full cursor-pointer relative overflow-hidden"
        >
          <div
            className="h-full bg-m3-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="hover:text-m3-primary transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="hover:text-m3-primary transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
          <span className="text-[10px] font-mono text-white/80 select-none">
            Video Preview
          </span>
        </div>
      </div>
    </div>
  );
};
