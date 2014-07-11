-- phpMyAdmin SQL Dump
-- version 3.5.7
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: Jul 11, 2014 at 12:33 PM
-- Server version: 5.5.29
-- PHP Version: 5.4.10

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

--
-- Database: `kwielford`
--

-- --------------------------------------------------------

--
-- Table structure for table `mood_metrics`
--

CREATE TABLE `mood_metrics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created` int(11) NOT NULL,
  `energy` float NOT NULL,
  `stress` float NOT NULL,
  `hunger` float NOT NULL,
  `thirst` float NOT NULL,
  `temperature` float NOT NULL,
  `sociability` float NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `created` (`created`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci AUTO_INCREMENT=1 ;
