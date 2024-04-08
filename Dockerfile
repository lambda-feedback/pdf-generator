# Stage 1: Build TypeScript code and install Pandoc
FROM public.ecr.aws/lambda/nodejs:16 as builder

# Install tar and gzip
RUN yum install -y tar gzip

# Download and install Pandoc
RUN curl -fsSL https://github.com/jgm/pandoc/releases/download/2.16/pandoc-2.16-linux-amd64.tar.gz -o /tmp/pandoc.tar.gz \
  && tar -xzf /tmp/pandoc.tar.gz -C /tmp \
  && mv /tmp/pandoc-2.16/bin/pandoc /usr/bin \
  && rm -rf /tmp/pandoc.tar.gz /tmp/pandoc-2.16

RUN chmod +x /usr/bin/pandoc

# Copy package.json and install dependencies
WORKDIR /usr/app
COPY package.json .
RUN npm install

# Copy and build TypeScript code
COPY index.ts .
RUN npm run build

# Stage 2: Final image
FROM public.ecr.aws/lambda/nodejs:16

# Copy built files from previous stage
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./

# Set the Lambda function handler
CMD ["index.handler"]