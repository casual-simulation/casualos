FROM ubuntu:latest

ARG DEBIAN_FRONTEND=noninteractive
ENV TZ="US/Eastern"

RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common \
    sudo \
    build-essential \
    wget \
    tar \
    git-all


#Docker 19
ENV DOCKER_BUCKET="download.docker.com" \
    DOCKER_CHANNEL="stable" \
    DIND_COMMIT="3b5fac462d21ca164b3778647420016315289034"

ENV DOCKER_SHA256="9cd49fe82f6b7ec413b04daef35bc0c87b01d6da67611e5beef36291538d3145"
ENV DOCKER_VERSION="19.03.11"

VOLUME /var/lib/docker

# Install Docker
RUN set -ex \
    && curl -fSL "https://${DOCKER_BUCKET}/linux/static/${DOCKER_CHANNEL}/aarch64/docker-${DOCKER_VERSION}.tgz" -o docker.tgz \
    && echo "${DOCKER_SHA256} *docker.tgz" | sha256sum -c - \
    && tar --extract --file docker.tgz --strip-components 1  --directory /usr/local/bin \
    && rm docker.tgz \
    && docker -v \
    # set up subuid/subgid so that "--userns-remap=default" works out-of-the-box
    && groupadd dockremap \
    && useradd -g dockremap dockremap \
    && echo 'dockremap:165536:65536' >> /etc/subuid \
    && echo 'dockremap:165536:65536' >> /etc/subgid \
    && wget "https://raw.githubusercontent.com/docker/docker/${DIND_COMMIT}/hack/dind" -O /usr/local/bin/dind \
    && chmod +x /usr/local/bin/dind

# RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
# RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
# RUN add-apt-repository "deb [arch=arm64] https://download.docker.com/linux/ubuntu focal stable"

# RUN apt-get install docker.io -y
# RUN gpasswd -a root docker

# Using Ubuntu
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
RUN sudo apt-get install -y nodejs

RUN npm install -g yarn

COPY dockerd-entrypoint.sh /usr/local/bin/

ENTRYPOINT ["dockerd-entrypoint.sh"]
