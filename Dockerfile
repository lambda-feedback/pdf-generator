ARG NODE_VERSION=20

# Stage 1: Install pandoc
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION} as pandoc

ARG PANDOC_VERSION=3.6.4

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

# Stage 3: Final image with LaTeX and pandoc
FROM public.ecr.aws/lambda/nodejs:${NODE_VERSION}

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Install LaTeX environment and dependencies
RUN dnf install -y \
  texlive-collection-latexrecommended.noarch \
  texlive-iftex.noarch \
  texlive-braket.noarch \
  texlive-cancel.noarch

# Copy the LaTeX template
COPY ./src/template.latex template.latex

# Copy built files from the previous stage
COPY --from=builder /app/dist/* ./

# Copy pandoc from the first stage
COPY --from=pandoc /usr/bin/pandoc /usr/bin/pandoc

# Set environment variables
ENV TEXMFHOME /tmp/texmf
ENV TEXMFCONFIG /tmp/texmf-config
ENV TEXMFVAR /tmp/texmf-var

RUN chmod +x /usr/bin/pandoc

# Set the Lambda function handler
CMD ["index.handler"]