pipeline {
    agent any

    tools {
        nodejs 'node-24'
    }

    environment {
        PM2_APP_NAME = "community-backend"
        DEPLOY_DIR = "/root/app-chat/Chat-Community"
        TELEGRAM_TOKEN   = credentials('telegram-bot-token')
        TELEGRAM_CHAT_ID = credentials('telegram-chat-id')
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

                echo '=== Loại bỏ devDependencies để chuẩn bị bản deploy tối ưu ==='
                sh 'npm prune --omit=dev'
            }
        }

        stage('🚀 4. Triển Khai Lên Vùng Chạy Thật (Deploy)') {
            steps {
                echo '=== Đang dọn dẹp và chuyển giao sản phẩm sang thư mục vận hành ==='
                sh "mkdir -p ${env.DEPLOY_DIR}"
                sh "rsync -avz --delete dist node_modules package.json package-lock.json ${env.DEPLOY_DIR}/"
                
                echo '=== Đang cài đặt môi trường production tại thư mục chạy thật ==='
                dir("${env.DEPLOY_DIR}") {
                    echo '=== Khởi động / Tái khởi động ứng dụng bằng PM2 ==='
                    sh "pm2 reload ${env.PM2_APP_NAME} --update-env || pm2 start dist/index.js --name ${env.PM2_APP_NAME}"
                    
                    sh 'pm2 save'
                }
            }
        }
    }

    post {
        success {
            script {
                def message = "✅ *JENKINS DEPLOY SUCCESS* 🚀%0A%0A" +
                              "📦 *Dự án:* ${env.JOB_NAME}%0A" +
                              "🔢 *Build số:* #${env.BUILD_NUMBER}%0A" +
                              "🔗 *Chi tiết:* [Xem tại đây](${env.BUILD_URL})"
                              
                sh "curl -s -X POST https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage " +
                   "-d chat_id=${env.TELEGRAM_CHAT_ID} " +
                   "-d text='${message}' " +
                   "-d parse_mode='Markdown'"
            }
        }
        failure {
            script {
                def message = "❌ *JENKINS DEPLOY FAILED* 🚨%0A%0A" +
                              "📦 *Dự án:* ${env.JOB_NAME}%0A" +
                              "🔢 *Build số:* #${env.BUILD_NUMBER}%0A" +
                              "💥 *Trạng thái:* Quá trình build hoặc deploy bị lỗi!%0A" +
                              "🔗 *Kiểm tra log:* [Xem tại đây](${env.BUILD_URL}console)"
                              
                sh "curl -s -X POST https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage " +
                   "-d chat_id=${env.TELEGRAM_CHAT_ID} " +
                   "-d text='${message}' " +
                   "-d parse_mode='Markdown'"
            }
        }
    }
}