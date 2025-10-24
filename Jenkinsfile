pipeline {
    agent any

    stages {
        stage('Hello') {
            steps {
                checkout scm
                echo 'Hello World'
                sh 'ls'
            }
        }
        stage('Testing') {
            steps {
                echo 'test'            
            }
        }
        
    }
}
