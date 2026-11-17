def notifyTelegram(String text) {
    withEnv(["TG_TEXT=${text}"]) {
        sh '''
            curl -s -o /dev/null -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
                --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
                --data-urlencode "text=${TG_TEXT}" \
                --data-urlencode "parse_mode=Markdown" || true
        '''
    }
}

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

        stage('🔎 3. Kiểm Tra Chất Lượng (Type-check, Lint, Test)') {
            steps {
                sh 'npm run type-check'
                sh 'npm run lint'
                sh 'npm test -- --ci'
            }
        }

        stage('🏗️ 4. Biên Dịch Dự Án (Build BE)') {
            steps {
                echo '=== Đang build TypeScript sang JavaScript (thư mục dist) ==='
                sh 'npm run build'

                echo '=== Loại bỏ devDependencies để chuẩn bị bản deploy tối ưu ==='
                sh 'npm prune --omit=dev'
            }
        }

        stage('🚀 5. Triển Khai Lên Vùng Chạy Thật (Deploy)') {
            steps {
                echo '=== Đang dọn dẹp và chuyển giao sản phẩm sang thư mục vận hành ==='
                sh "mkdir -p ${env.DEPLOY_DIR}"
                sh "rsync -avz --delete dist node_modules package.json package-lock.json ${env.DEPLOY_DIR}/"

                dir("${env.DEPLOY_DIR}") {
                    echo '=== Khởi động / Tái khởi động ứng dụng bằng PM2 ==='
                    sh "pm2 reload ${env.PM2_APP_NAME} --update-env || pm2 start dist/index.js --name ${env.PM2_APP_NAME} --kill-timeout 12000"

                    sh 'pm2 save'
                }
            }
        }
    }

    post {
        success {
            script {
                notifyTelegram(
                    "✅ *JENKINS DEPLOY SUCCESS* 🚀\n\n" +
                    "📦 *Dự án:* ${env.JOB_NAME}\n" +
                    "🔢 *Build số:* #${env.BUILD_NUMBER}\n" +
                    "🔗 *Chi tiết:* [Xem tại đây](${env.BUILD_URL})"
                )
            }
        }
        failure {
            script {
                notifyTelegram(
                    "❌ *JENKINS DEPLOY FAILED* 🚨\n\n" +
                    "📦 *Dự án:* ${env.JOB_NAME}\n" +
                    "🔢 *Build số:* #${env.BUILD_NUMBER}\n" +
                    "💥 *Trạng thái:* Quá trình build hoặc deploy bị lỗi!\n" +
                    "🔗 *Kiểm tra log:* [Xem tại đây](${env.BUILD_URL}console)"
                )
            }
        }
    }
}
