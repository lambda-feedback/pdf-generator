# Stage 1: Build TypeScript code and install Pandoc
FROM public.ecr.aws/lambda/nodejs:16 as builder

# Install tar and gzip
RUN yum install -y tar gzip

# Download and install Pandoc
RUN curl -fsSL https://github.com/jgm/pandoc/releases/download/3.1.13/pandoc-3.1.13-linux-amd64.tar.gz -o /tmp/pandoc.tar.gz \
  && tar -xzf /tmp/pandoc.tar.gz -C /tmp \
  && mv /tmp/pandoc-3.1.13/bin/pandoc /usr/bin \
  && rm -rf /tmp/pandoc.tar.gz /tmp/pandoc-3.1.13

RUN /usr/bin/pandoc --help

RUN chmod +x /usr/bin/pandoc

# Copy package.json and install dependencies
WORKDIR /usr/app
COPY package.json .
RUN npm install

# Copy and build TypeScript code
COPY index.ts .
COPY template.latex template.latex
RUN npm run build

# Stage 2: Final image
FROM public.ecr.aws/lambda/nodejs:16

# Install Latex environment and dependencies
RUN yum install -y \
  texlive-collection-latexrecommended.noarch \
  texlive-iftex.noarch \
  texlive-collection-xetex.noarch \
  texlive-mathspec-svn15878.0.2-38.amzn2.0.5.noarch \
  texlive-euenc.noarch \
  texlive-xetex-def.noarch \
  texlive-xetex-bin-svn26912.0-38.20130427_r30134.amzn2.0.5.aarch64

# This fixes weird format not found issue, not sure how it works
RUN texconfig rehash

# Copy built files from previous stage
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/dist/* ./
COPY --from=builder /usr/bin/pandoc /usr/bin/pandoc
COPY --from=builder /usr/app/template.latex template.latex

RUN chmod +x /usr/bin/pandoc

# Set the Lambda function handler
CMD ["index.handler"]