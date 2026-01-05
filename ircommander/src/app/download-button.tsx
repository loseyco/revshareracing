"use client";

import { useEffect, useState } from "react";

interface ReleaseInfo {
  version: string;
  download_url: string;
  filename: string;
  release_notes?: string;
  published_at?: string;
}

export default function DownloadButton() {
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch latest release info
    fetch("/api/v1/releases/latest")
      .then((res) => res.json())
      .then((data: ReleaseInfo) => {
        setRelease(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch release info:", err);
        setError("Failed to load release information");
        setLoading(false);
      });
  }, []);

  const handleDownload = async () => {
    // The API always returns a download_url, so we should always have one
    if (!release?.download_url) {
      setError("No download URL available. Please refresh the page.");
      return;
    }

    const url = release.download_url;
    const filename = release.filename || "iRCommander.exe";

    setDownloading(true);
    setError(null);

    try {
      // Fetch the file from Supabase Storage
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      // Get the file as a blob
      const blob = await response.blob();
      
      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      setDownloading(false);
    } catch (err) {
      console.error("Download error:", err);
      setError(err instanceof Error ? err.message : "Failed to download file");
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <button
        disabled
        className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg flex items-center gap-2 opacity-50 cursor-not-allowed"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Loading...
      </button>
    );
  }

  // Always show the button - API always returns data (with fallback)
  const version = release?.version || "1.0.1";

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center gap-2"
      >
        {downloading ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Downloading...
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Client (v{version})
          </>
        )}
      </button>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}
