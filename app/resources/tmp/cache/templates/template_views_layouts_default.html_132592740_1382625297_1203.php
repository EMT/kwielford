<?php
/**
 * Lithium: the most rad php framework
 *
 * @copyright     Copyright 2013, Union of RAD (http://union-of-rad.org)
 * @license       http://opensource.org/licenses/bsd-license.php The BSD License
 */
?>
<!doctype html>
<html>
<head>
	<?php echo $this->html->charset();?>
	<title><?php echo $this->title(); ?></title>
	<?php echo $this->html->style(array('normalise.min', 'application')); ?>
	<?php echo $this->styles(); ?>
	<?php echo $this->html->link('Icon', null, array('type' => 'icon')); ?>
	<link rel=”apple-touch-icon-precomposed” sizes=”114×114″ href=”/apple-touch-icon-114×114-precomposed.png”>
	<link rel=”apple-touch-icon-precomposed” sizes=”72×72″ href=”/apple-touch-icon-72×72-precomposed.png”>
	<link rel=”apple-touch-icon-precomposed” href=”/touch-icon-iphone-precomposed.png”>
	<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
</head>
<body class="lithified">
	<div class="container-narrow">

		<header class="masthead">
			
		</header>


		<div class="content">
			<?php echo $this->content(); ?>
		</div>


		<div class="footer">
			
		</div>

	</div>

	<?php echo $this->scripts(); ?>

</body>
</html>