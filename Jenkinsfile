pipeline {
  agent {
    kubernetes {
      yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-agent
  containers:
    - name: python
      image: python:3.13
      command: ["sleep"]
      args: ["infinity"]
    - name: gitleaks
      image: zricethezav/gitleaks:v8.21.2
      command: ["sleep"]
      args: ["infinity"]
    - name: buildkit
      image: moby/buildkit:v0.35.0-rootless
      command: ["sleep"]
      args: ["infinity"]
      env:
        - name: BUILDKITD_FLAGS
          value: --oci-worker-no-process-sandbox
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        seccompProfile:
          type: Unconfined
        appArmorProfile:
          type: Unconfined
      resources:
        limits:
          memory: 2Gi
      volumeMounts:
        - name: buildkitd
          mountPath: /home/user/.local/share/buildkit
    - name: trivy
      image: aquasec/trivy:0.58.0
      command: ["sleep"]
      args: ["infinity"]
    - name: helm
      image: alpine/helm:3.16.2
      command: ["sleep"]
      args: ["infinity"]
  volumes:
    - name: buildkitd
      emptyDir: {}
'''
    }
  }
  options {
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
  }
  environment {
    API_IMAGE = 'ghcr.io/cel6586/game-tracker-api'
    WEB_IMAGE = 'ghcr.io/cel6586/game-tracker-web'
  }
  stages {
    stage('Checks') {
      parallel {
        stage('Test') {
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
        stage('Secret scan') {
          steps {
            container('gitleaks') {
              sh 'git config --global --add safe.directory "$WORKSPACE"'
              sh 'gitleaks detect --source . --verbose'
            }
          }
        }
      }
    }
    // Builds both images into tar files. Nothing is pushed yet.
    stage('Build images') {
      when { branch 'main' }
      steps {
        container('buildkit') {
          sh '''
            buildctl-daemonless.sh build --frontend dockerfile.v0 --local context=api --local dockerfile=api --output type=docker,name=$API_IMAGE:$GIT_COMMIT,dest=api.tar
            buildctl-daemonless.sh build --frontend dockerfile.v0 --local context=web --local dockerfile=web --output type=docker,name=$WEB_IMAGE:$GIT_COMMIT,dest=web.tar
          '''
        }
      }
    }
    // Scans the tar files. A HIGH or CRITICAL finding stops the pipeline before the push.
    stage('Trivy scan') {
      when { branch 'main' }
      steps {
        container('trivy') {
          sh 'trivy image --no-progress --input api.tar --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1'
          sh 'trivy image --no-progress --input web.tar --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1'
        }
      }
    }
    // Runs the same builds again with push on. BuildKit reuses its cache, so this is quick.
    stage('Push images') {
      when { branch 'main' }
      steps {
        container('buildkit') {
          withCredentials([usernamePassword(credentialsId: 'github', usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
            sh '''
              export DOCKER_CONFIG=$(mktemp -d)
              AUTH=$(printf '%s:%s' "$GH_USER" "$GH_TOKEN" | base64 | tr -d '\\n')
              printf '{"auths":{"ghcr.io":{"auth":"%s"}}}' "$AUTH" > "$DOCKER_CONFIG/config.json"
              buildctl-daemonless.sh build --frontend dockerfile.v0 --local context=api --local dockerfile=api --output type=image,name=$API_IMAGE:$GIT_COMMIT,push=true
              buildctl-daemonless.sh build --frontend dockerfile.v0 --local context=web --local dockerfile=web --output type=image,name=$WEB_IMAGE:$GIT_COMMIT,push=true
            '''
          }
        }
      }
    }
    stage('Deploy') {
      when { branch 'main' }
      steps {
        container('helm') {
          sh 'helm upgrade --install game-tracker chart --namespace game-tracker --set image.tag="$GIT_COMMIT" --wait'
        }
      }
    }
  }
}
