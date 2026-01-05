import { NextResponse } from 'next/server';

/**
 * API route to fetch the latest GitHub release download URL
 * This ensures we always get the correct download link even if asset names change
 */
export async function GET() {
  try {
    const response = await fetch(
      'https://api.github.com/repos/loseyco/revshareracing/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RevShareRacing-WebApp',
        },
        // Cache for 5 minutes to reduce API calls
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    const release = await response.json();
    const tagName = release.tag_name;
    
    // Find the RevShareRacing.exe asset
    const exeAsset = release.assets?.find((asset: any) => 
      asset.name === 'RevShareRacing.exe' || asset.name.toLowerCase().includes('revshareracing')
    );

    if (!exeAsset || !tagName) {
      // Fallback to releases page if no asset found or no tag
      return NextResponse.json({
        downloadUrl: `https://github.com/loseyco/revshareracing/releases/latest`,
        releaseUrl: release.html_url,
        version: tagName,
        hasAsset: false,
      });
    }

    // Construct direct download URL using the exact pattern that works:
    // https://github.com/loseyco/revshareracing/releases/download/{tag}/RevShareRacing.exe
    const directDownloadUrl = `https://github.com/loseyco/revshareracing/releases/download/${tagName}/RevShareRacing.exe`;

    return NextResponse.json({
      downloadUrl: directDownloadUrl, // Direct download URL using confirmed working pattern
      releaseUrl: release.html_url,
      version: tagName,
      hasAsset: true,
      assetName: exeAsset.name,
      assetSize: exeAsset.size,
    });
  } catch (error) {
    console.error('Error fetching latest release:', error);
    // Fallback to releases page on error
    return NextResponse.json({
      downloadUrl: `https://github.com/loseyco/revshareracing/releases/latest`,
      releaseUrl: `https://github.com/loseyco/revshareracing/releases/latest`,
      version: null,
      hasAsset: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
