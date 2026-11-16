pipeline {
  agent {
    kubernetes {
      yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: python
      image: python:3.13
      command: ["sleep"]
      args: ["infinity"]
'''
    }
  }
  stages {
    stage('testing') {
      steps {
        container('python') {
          dir('api') {
            sh 'pip install -r requirements-dev.txt'
            sh 'pytest'
            sh 'ruff check .'
          }
        }
      }
    }
  }
}