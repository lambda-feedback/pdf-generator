ARG NODE_VERSION=20

# Stage 1: Install pandoc
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION} as pandoc

ARG PANDOC_VERSION=3.1.13

# Install tar and gzip
RUN dnf install -y tar gzip

# Download and install Pandoc
RUN curl -fsSL https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-linux-amd64.tar.gz -o /tmp/pandoc.tar.gz \
  && tar -xzf /tmp/pandoc.tar.gz -C /tmp \
  && mv /tmp/pandoc-${PANDOC_VERSION}/bin/pandoc /usr/bin \
  && rm -rf /tmp/pandoc.tar.gz /tmp/pandoc-${PANDOC_VERSION}

RUN chmod +x /usr/bin/pandoc

# Stage 2: Build the Lambda function
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION} as builder

# Copy package.json and package-lock.json and install dependencies
WORKDIR /app

COPY package*.json .

RUN npm install

# Copy and build TypeScript code
COPY . .

RUN npm run build

# Stage 3: Final image
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION}

WORKDIR ${LAMBDA_TASK_ROOT}

# Install Latex environment and dependencies
RUN dnf install -y \
  texlive-collection-latexrecommended.noarch \
  texlive-iftex.noarch

# Add library to handle cancel
FROM texlive/texlive
RUN tlmgr install cancel braket

# Copy the LaTeX template
COPY ./src/template.latex template.latex

# Copy built files from previous stage
COPY --from=builder /app/dist/* ./
COPY --from=pandoc /usr/bin/pandoc /usr/bin/pandoc

ENV TEXMFHOME /tmp/texmf
ENV TEXMFCONFIG /tmp/texmf-config
ENV TEXMFVAR /tmp/texmf-var

RUN chmod +x /usr/bin/pandoc

# Set the Lambda function handler
CMD ["index.handler"]