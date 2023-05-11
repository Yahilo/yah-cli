/**
 * Copyright (c) Appblocks. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutBucketWebsiteCommand,
  PutObjectCommand,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
} = require('@aws-sdk/client-s3')
const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const { awsHandler } = require('..')

class S3_Handler {
  constructor() {
    this.init()
  }

  init() {
    if (this.S3Client) return

    const { region, accessKeyId, secretAccessKey } = awsHandler.getAWSCredConfig

    this.S3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  async createBucket(options) {
    const { bucket } = options
    const command = new CreateBucketCommand({
      Bucket: bucket,
      // ObjectOwnership: 'BucketOwnerPreferred',
      // ACL: 'public-read',
    })
    await this.S3Client.send(command)

    await this.putPublicAccess(options)

    return { bucket }
  }

  async deleteBucket(options) {
    const { bucket } = options
    // Create a command to list all objects in the bucket
    const listObjectsCommand = new ListObjectsCommand({ Bucket: bucket })

    // Send the command to list all objects in the bucket
    this.S3Client.send(listObjectsCommand)
      .then((data) => {
        // Delete each object in the bucket

        if (!data.Contents?.length) {
          return []
        }

        const objectKeys = data.Contents.map((object) => ({ Key: object.Key }))
        const deleteObjectPromises = objectKeys.map((objectKey) =>
          this.S3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey.Key }))
        )
        return Promise.all(deleteObjectPromises)
      })
      .then(() =>
        // Once all objects are deleted, delete the bucket
        this.S3Client.send(new DeleteBucketCommand({ Bucket: bucket }))
      )
      .then(() => {
        console.log(`Bucket ${bucket} deleted successfully`)
      })
      .catch((err) => {
        console.log(`Bucket ${bucket}: ${err.message}`)
        // console.error(err, err.stack)
      })
  }

  async putPublicAccess(options) {
    const { bucket } = options
    const input = {
      Bucket: bucket,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    }
    const command = new PutPublicAccessBlockCommand(input)
    await this.S3Client.send(command)
    return { bucket }
  }

  async putBucketPolicy(options) {
    const { bucket } = options
    const policy = `{"Version":"2012-10-17","Statement":[{"Sid":"PublicReadGetObject","Effect":"Allow","Principal":"*","Action":["s3:GetObject","s3:GetObjectVersion"],"Resource":"arn:aws:s3:::${bucket}/*"}]}`
    const command = new PutBucketPolicyCommand({
      Policy: policy,
      Bucket: bucket,
    })
    await this.S3Client.send(command)
    return { bucket, policy }
  }

  async putBucketCors(options) {
    const { bucket } = options
    const corsRules = [
      {
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET'],
        AllowedOrigins: ['*'],
        ExposeHeaders: [],
      },
    ]
    const command = new PutBucketCorsCommand({
      CORSConfiguration: { CORSRules: corsRules },
      Bucket: bucket,
    })
    await this.S3Client.send(command)
    return { bucket, corsRules }
  }

  async putBucketWebsite(options) {
    const { bucket } = options
    const { region } = awsHandler.getAWSCredConfig
    const command = new PutBucketWebsiteCommand({
      WebsiteConfiguration: {
        ErrorDocument: { Key: 'index.html' },
        IndexDocument: { Suffix: 'index.html' },
        // RedirectAllRequestsTo
        // RoutingRules
      },
      Bucket: bucket,
    })
    await this.S3Client.send(command)
    return { bucket, static_host: `http://${bucket}.s3-website-${region}.amazonaws.com/` }
  }

  async uploadDir(options) {
    const { bucket, dirPath, prefix, backupPath } = options

    if (backupPath) {
      fs.cpSync(dirPath, backupPath, { overwrite: true, recursive: true })
    }

    const files = fs.readdirSync(dirPath)
    const uploadedBlocks = []
    const uploads = files.map(async (fileName) => {
      const filePath = dirPath.includes(path.resolve())
        ? path.join(dirPath, fileName)
        : path.join(path.resolve(), dirPath, fileName)

      const ContentType = mime.lookup(fileName) || 'application/x-javascript'
      const Key = prefix ? `${prefix}/${fileName}` : fileName

      const command = new PutObjectCommand({
        Bucket: bucket,
        Body: fs.createReadStream(filePath),
        ContentType,
        Key,
      })

      await this.S3Client.send(command)
      uploadedBlocks.push(Key)
    })

    await Promise.all(uploads)
    return uploadedBlocks
  }
}

const s3Handler = new S3_Handler()
module.exports = { S3_Handler, s3Handler }
