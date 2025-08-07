import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { width: string; height: string } }
) {
  const { width, height } = params
  const searchParams = request.nextUrl.searchParams
  const color = searchParams.get('color') || '6B7280'
  const text = searchParams.get('text') || 'Image'
  
  const w = parseInt(width) || 400
  const h = parseInt(height) || 300
  
  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="#${color}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="20" 
        fill="white" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >
        ${text}
      </text>
    </svg>
  `
  
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}