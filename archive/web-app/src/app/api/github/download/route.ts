import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering to prevent ISR and avoid oversized page errors
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Proxy endpoint that downloads the latest release from GitHub and streams it to the user
 * This ensures the file downloads directly instead of navigating to GitHub
 */
export async function GET(request: NextRequest) {
  try {
    // First, get the latest release info
    const releaseResponse = await fetch(
      'https://api.github.com/repos/loseyco/revshareracing/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'RevShareRacing-WebApp',
        },
        // Use cache-control header instead of next revalidate for dynamic routes
        cache: 'no-store',
      }
    );

    if (!releaseResponse.ok) {
      throw new Error(`GitHub API returned ${releaseResponse.status}`);
    }

    const release = await releaseResponse.json();
    const tagName = release.tag_name;
    
    // Find the RevShareRacing.exe asset
    const exeAsset = release.assets?.find((asset: any) => 
      asset.name === 'RevShareRacing.exe' || asset.name.toLowerCase().includes('revshareracing')
    );

    if (!exeAsset || !tagName) {
      // Redirect to releases page if no asset found
      return NextResponse.redirect('https://github.com/loseyco/revshareracing/releases/latest');
    }

    // Construct direct download URL
    const downloadUrl = `https://github.com/loseyco/revshareracing/releases/download/${tagName}/RevShareRacing.exe`;

    // Fetch the file from GitHub
    const fileResponse = await fetch(downloadUrl, {
      headers: {
        'Accept': 'application/octet-stream',
        'User-Agent': 'RevShareRacing-WebApp',
      },
    });

    if (!fileResponse.ok) {
      // If direct download fails, redirect to releases page
      return NextResponse.redirect('https://github.com/loseyco/revshareracing/releases/latest');
    }

    // Get the file as a stream
    const fileBuffer = await fileResponse.arrayBuffer();

    // Return the file with proper headers to force download
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${exeAsset.name}"`,
        'Content-Length': exeAsset.size.toString(),
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Error downloading release:', error);
    // Redirect to releases page on error
    return NextResponse.redirect('https://github.com/loseyco/revshareracing/releases/latest');
  }
}
