"use server"

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { randomBytes } from "crypto"

export async function getPresignedUrl(filename: string, contentType: string) {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucketName = process.env.R2_BUCKET_NAME

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("R2 configuration is missing")
  }

  const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  // Generate a unique filename to prevent collisions
  const extension = filename.split('.').pop()
  const randomString = randomBytes(8).toString('hex')
  const key = `products/${randomString}.${extension}`

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  })

  try {
    const signedUrl = await getSignedUrl(S3, command, { expiresIn: 3600 })
    
    // Return both the upload URL and the public URL where the image will be accessible
    // Note: You must configure a custom domain or public bucket URL in Cloudflare R2 for this to work
    const publicDomain = process.env.R2_PUBLIC_URL
    if (!publicDomain) {
      throw new Error("R2_PUBLIC_URL is not set")
    }
    const cleanDomain = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain
    const publicUrl = `${cleanDomain}/${key}`

    return { uploadUrl: signedUrl, publicUrl, key }
  } catch (error) {
    console.error("Error generating presigned URL:", error)
    throw new Error("Could not generate presigned URL")
  }
}
