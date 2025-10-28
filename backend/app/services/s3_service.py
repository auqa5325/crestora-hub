import boto3
import os
from datetime import datetime
from typing import List, Dict, Optional
from botocore.exceptions import ClientError, NoCredentialsError
import logging

logger = logging.getLogger(__name__)

class S3Service:
    def __init__(self):
        self.aws_access_key_id = os.getenv('AWS_ACCESS_KEY_ID')
        self.aws_secret_access_key = os.getenv('AWS_SECRET_ACCESS_KEY')
        self.aws_region = os.getenv('AWS_REGION', 'ap-south-1')
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'crestora-uploads')
        
        logger.info(f"S3 Service initialization - AWS_ACCESS_KEY_ID: {'***' if self.aws_access_key_id else 'NOT SET'}")
        logger.info(f"S3 Service initialization - AWS_SECRET_ACCESS_KEY: {'***' if self.aws_secret_access_key else 'NOT SET'}")
        logger.info(f"S3 Service initialization - AWS_REGION: {self.aws_region}")
        logger.info(f"S3 Service initialization - S3_BUCKET_NAME: {self.bucket_name}")
        
        if not all([self.aws_access_key_id, self.aws_secret_access_key]):
            logger.warning("AWS credentials not found in environment variables")
            self.s3_client = None
            return
            
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.aws_region
            )
            logger.info(f"S3 client initialized successfully for bucket: {self.bucket_name}")
            
            # Test bucket access
            try:
                self.s3_client.head_bucket(Bucket=self.bucket_name)
                logger.info(f"S3 bucket '{self.bucket_name}' is accessible")
            except ClientError as e:
                logger.error(f"S3 bucket '{self.bucket_name}' is not accessible: {str(e)}")
                self.s3_client = None
                
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {str(e)}")
            self.s3_client = None

    def upload_file(self, file_content: bytes, file_name: str, folder_path: str = "") -> Dict[str, str]:
        """
        Upload a file to S3
        
        Args:
            file_content: File content as bytes
            file_name: Name of the file
            folder_path: Folder path in S3 (e.g., 'rollingresults/event1/')
            
        Returns:
            Dict with upload result information
        """
        if not self.s3_client:
            raise Exception("S3 client not initialized")
            
        try:
            # Create the full S3 key
            s3_key = f"{folder_path}{file_name}" if folder_path else file_name
            
            # Upload file
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType='text/csv'
            )
            
            # Generate the file URL
            file_url = f"https://{self.bucket_name}.s3.{self.aws_region}.amazonaws.com/{s3_key}"
            
            logger.info(f"File uploaded successfully: {s3_key}")
            
            return {
                "success": True,
                "file_key": s3_key,
                "file_url": file_url,
                "bucket": self.bucket_name,
                "message": "File uploaded successfully"
            }
            
        except ClientError as e:
            logger.error(f"AWS S3 error: {str(e)}")
            raise Exception(f"Failed to upload file to S3: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during file upload: {str(e)}")
            raise Exception(f"Failed to upload file: {str(e)}")

    def list_files(self, folder_path: str = "") -> List[Dict[str, str]]:
        """
        List files in a specific folder
        
        Args:
            folder_path: Folder path in S3 (e.g., 'rollingresults/')
            
        Returns:
            List of file information dictionaries
        """
        if not self.s3_client:
            raise Exception("S3 client not initialized")
            
        try:
            # List objects with the folder prefix
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=folder_path
            )
            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Skip folder markers (keys ending with '/')
                    if obj['Key'].endswith('/'):
                        continue
                        
                    # Extract filename from the full key
                    filename = obj['Key'].split('/')[-1]
                    
                    # Extract event name from folder path
                    event_name = "Unknown"
                    if '/' in obj['Key']:
                        path_parts = obj['Key'].split('/')
                        if len(path_parts) >= 2:
                            event_name = path_parts[-2]  # Second to last part is event name
                    
                    files.append({
                        "key": obj['Key'],
                        "filename": filename,
                        "size": obj['Size'],
                        "lastModified": obj['LastModified'].isoformat(),
                        "eventName": event_name,
                        "url": f"https://{self.bucket_name}.s3.{self.aws_region}.amazonaws.com/{obj['Key']}"
                    })
            
            logger.info(f"Listed {len(files)} files from folder: {folder_path}")
            return files
            
        except ClientError as e:
            logger.error(f"AWS S3 error: {str(e)}")
            raise Exception(f"Failed to list files from S3: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during file listing: {str(e)}")
            raise Exception(f"Failed to list files: {str(e)}")

    def delete_file(self, file_key: str) -> Dict[str, str]:
        """
        Delete a file from S3
        
        Args:
            file_key: Full S3 key of the file to delete
            
        Returns:
            Dict with deletion result information
        """
        if not self.s3_client:
            raise Exception("S3 client not initialized")
            
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=file_key
            )
            
            logger.info(f"File deleted successfully: {file_key}")
            
            return {
                "success": True,
                "message": "File deleted successfully"
            }
            
        except ClientError as e:
            logger.error(f"AWS S3 error: {str(e)}")
            raise Exception(f"Failed to delete file from S3: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during file deletion: {str(e)}")
            raise Exception(f"Failed to delete file: {str(e)}")

    def get_file_url(self, file_key: str, expiration: int = 3600) -> str:
        """
        Generate a presigned URL for file access
        
        Args:
            file_key: Full S3 key of the file
            expiration: URL expiration time in seconds (default: 1 hour)
            
        Returns:
            Presigned URL string
        """
        if not self.s3_client:
            raise Exception("S3 client not initialized")
            
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': file_key},
                ExpiresIn=expiration
            )
            
            return url
            
        except ClientError as e:
            logger.error(f"AWS S3 error: {str(e)}")
            raise Exception(f"Failed to generate presigned URL: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during URL generation: {str(e)}")
            raise Exception(f"Failed to generate URL: {str(e)}")

# Global instance
s3_service = S3Service()
