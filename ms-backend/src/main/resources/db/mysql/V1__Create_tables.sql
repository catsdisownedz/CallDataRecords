-- Create the cdrs table
 CREATE TABLE cdrs (
                      id BIGINT AUTO_INCREMENT PRIMARY KEY,
                      anum VARCHAR(255) NOT NULL,
                      bnum VARCHAR(255),
                      serviceType VARCHAR(255) NOT NULL,
                      `usage` DOUBLE NOT NULL,  -- ✅ usage is wrapped in backticks
                      startDateTime VARCHAR(255) NOT NULL  -- ✅ fixed NOT NULL typo
) ENGINE=InnoDB;


-- Create the users table
CREATE TABLE users (
                       id BIGINT AUTO_INCREMENT PRIMARY KEY,
                       username VARCHAR(255) UNIQUE NOT NULL,
                       password VARCHAR(255) NOT NULL
) ENGINE=InnoDB;
