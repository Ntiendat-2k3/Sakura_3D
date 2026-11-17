'use client';

// Màn hình tải tài nguyên game với ảnh nền anime cyberpunk và thanh tiến trình nạp đồ họa thời gian thực.
import React, { useEffect, useRef, useState } from 'react';

export function GameLoadingScreen({
  progress = 0,
  statusText = 'Đang khởi tạo Neon Sakura City…',
  ready = false,
  backgroundImage = '/assets/ui/loading-bg.jpg',
}: {
  progress?: number;
  statusText?: string;
  ready?: boolean;
  backgroundImage?: string;
}) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const completedRef = useRef(false);

  // Loading ingame chỉ tải 1 lần duy nhất mỗi khi vào game; không hiện lại khi ra vào phòng
  useEffect(() => {
    if (completedRef.current) return;
    if (ready) {
      const timer = setTimeout(() => {
        setFading(true);
        const hideTimer = setTimeout(() => {
          completedRef.current = true;
          setVisible(false);
        }, 650);
        return () => clearTimeout(hideTimer);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [ready]);

  if (!visible || completedRef.current) return null;

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      className={`game-loading-overlay ${fading ? 'is-fading' : ''}`}
      style={{
        backgroundImage: `radial-gradient(circle at 50% 40%, rgba(18, 10, 30, 0.4) 0%, rgba(8, 4, 15, 0.88) 85%), url('${backgroundImage}')`,
      }}
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Tiến trình tải đồ họa trò chơi"
    >
      <div className="game-loading-content">
        {/* Tiêu đề & Logo */}
        <header className="game-loading-header">
          <span className="game-loading-eyebrow">NEON SAKURA CITY</span>
          <h1 className="game-loading-title">HUYẾT NGUYỆT ĐÔ THỊ</h1>
          <p className="game-loading-subtitle">Đang nạp toàn bộ kiến trúc 3D, nhân vật và vật liệu GPU…</p>
        </header>

        {/* Khung thanh tiến trình neon */}
        <div className="game-loading-bar-wrapper">
          <div className="game-loading-bar-glow">
            <div
              className="game-loading-bar-fill"
              style={{ width: `${clampedProgress}%` }}
            >
              <span className="game-loading-bar-shimmer" />
            </div>
          </div>
          <div className="game-loading-meta">
            <span className="game-loading-status">{statusText}</span>
            <span className="game-loading-percent">{clampedProgress}%</span>
          </div>
        </div>

        {/* Chú thích & Mẹo điều khiển */}
        <footer className="game-loading-footer">
          <span className="game-loading-tip-badge">MẸO KHÁM PHÁ</span>
          <p className="game-loading-tips">
            Di chuyển bằng <strong>WASD</strong> · Đi bộ gần ngưỡng cửa để vào Club, Reika Lounge hoặc lên tầng 2 Cyber Love Hotel.
          </p>
        </footer>
      </div>

      <style jsx>{`
        .game-loading-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-color: #0c0817;
          opacity: 1;
          transition: opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.65s;
          pointer-events: all;
          user-select: none;
        }

        .game-loading-overlay.is-fading {
          opacity: 0;
          pointer-events: none;
          visibility: hidden;
        }

        .game-loading-content {
          width: 90%;
          max-width: 580px;
          padding: 38px 36px 32px;
          background: rgba(14, 10, 24, 0.78);
          border: 1px solid rgba(255, 75, 140, 0.35);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65), 0 0 32px rgba(255, 40, 100, 0.22);
          backdrop-filter: blur(16px);
          border-radius: 20px;
          text-align: center;
          color: #fff;
          display: flex;
          flex-direction: column;
          gap: 22px;
          animation: floatIn 0.5s ease-out;
        }

        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .game-loading-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .game-loading-eyebrow {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.22em;
          color: #ff548e;
          text-transform: uppercase;
        }

        .game-loading-title {
          margin: 0;
          font-size: 1.85rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          background: linear-gradient(135deg, #ffffff 30%, #ff80a6 75%, #ff3b68 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 24px rgba(255, 60, 110, 0.45);
        }

        .game-loading-subtitle {
          margin: 0;
          font-size: 0.88rem;
          color: rgba(235, 220, 255, 0.72);
        }

        .game-loading-bar-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .game-loading-bar-glow {
          position: relative;
          height: 12px;
          background: rgba(22, 14, 38, 0.9);
          border: 1px solid rgba(255, 79, 140, 0.4);
          border-radius: 999px;
          overflow: hidden;
          box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.7), 0 0 12px rgba(255, 50, 110, 0.25);
        }

        .game-loading-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff2e75 0%, #ba38ff 55%, #00e5ff 100%);
          border-radius: 999px;
          position: relative;
          transition: width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
          box-shadow: 0 0 16px rgba(255, 65, 130, 0.85);
        }

        .game-loading-bar-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.5) 50%,
            transparent 100%
          );
          animation: shimmer 1.8s infinite;
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .game-loading-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.82rem;
        }

        .game-loading-status {
          color: #e6dcfa;
          font-weight: 500;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 80%;
        }

        .game-loading-percent {
          font-family: monospace;
          font-size: 0.95rem;
          font-weight: 700;
          color: #00f0ff;
          text-shadow: 0 0 10px rgba(0, 240, 255, 0.65);
        }

        .game-loading-footer {
          margin-top: 4px;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 0.78rem;
          color: rgba(220, 210, 240, 0.6);
        }

        .game-loading-tip-badge {
          background: rgba(255, 60, 120, 0.2);
          color: #ff6699;
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          letter-spacing: 0.06em;
          border: 1px solid rgba(255, 60, 120, 0.35);
        }

        .game-loading-tips strong {
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
