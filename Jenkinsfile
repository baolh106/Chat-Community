pipeline {
    agent any

    tools {
        nodejs 'node-24'
    }

    environment {
        PM2_APP_NAME = "community-backend"
        DEPLOY_DIR = "/root/app-chat/Chat-Community"
    }
    stages {
        stage('📦 1. Kéo Code Từ GitHub') {
            steps {
                echo '=== Đang đồng bộ code mới nhất từ GitHub về máy ảo Jenkins ==='
                checkout scm
            }
        }

        stage('📥 2. Cài Đặt Thư Viện (Dependencies)') {
            steps {
                echo '=== Đang cài đặt các package npm ==='
                sh 'npm ci'
            }
        }

        stage('🏗️ 3. Biên Dịch Dự Án (Build BE)') {
            steps {
                echo '=== Đang build code NestJS/TypeScript sang JavaScript (thư mục dist) ==='
                sh 'npm run build'
            }
        }

        stage('🚀 4. Triển Khai Lên Vùng Chạy Thật (Deploy)') {
            steps {
                echo '=== Đang dọn dẹp và chuyển giao sản phẩm sang thư mục vận hành ==='
                sh "mkdir -p ${env.DEPLOY_DIR}"
                sh "cp -R dist package.json package-lock.json ${env.DEPLOY_DIR}/"
                
                echo '=== Đang cài đặt môi trường production tại thư mục chạy thật ==='
                dir("${env.DEPLOY_DIR}") {
                    sh 'npm ci --omit=dev'
                    
                    echo '=== Khởi động / Tái khởi động ứng dụng bằng PM2 ==='
                    sh "pm2 reload ${env.PM2_APP_NAME} --update-env || pm2 start dist/main.js --name ${env.PM2_APP_NAME}"
                    
                    sh 'pm2 save'
                }
            }
        }
    }

    post {
        always {
            echo '=== Hoàn thành chu kỳ Pipeline ==='
        }
    }
}