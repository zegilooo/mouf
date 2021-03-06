<?php
/*
 * This file is part of the Mouf core package.
 *
 * (c) 2012 David Negrier <david@mouf-php.com>
 *
 * For the full copyright and license information, please view the LICENSE.txt
 * file that was distributed with this source code.
 */
namespace Mouf\Reflection;

use Mouf\MoufPropertyDescriptor;

/**
 * Extended Reflection class for class methods that allows usage of annotations.
 * 
 */
class MoufReflectionMethod extends \ReflectionMethod implements MoufReflectionMethodInterface
{
    /**
     * name of the reflected class
     *
     * @var  string
     */
    protected $className;
    /**
     * The class the object was built from
     *
     * @var  MoufReflectionClass
     */
    protected $refClass;
    
    /**
     * The declaring class of the method
     *
     * @var  MoufReflectionClass
     */
    protected $declaringClass;
    
    /**
     * name of the reflected method
     *
     * @var  string
     */
    protected $methodName;
    
    /**
	 * The phpDocComment we will use to access annotations.
	 *
	 * @var MoufPhpDocComment
	 */
	private $docComment;

    /**
     * constructor
     *
     * @param  string|MoufReflectionClass  $class       name of class to reflect
     * @param  string                          $methodName  name of method to reflect
     */
    public function __construct($class, $methodName)
    {
        if ($class instanceof MoufReflectionClass) {
            $this->refClass   = $class;
            $this->className  = $this->refClass->getName();
        } else {
            $this->className  = $class;
        }
        
        $this->methodName = $methodName;
        parent::__construct($this->className, $methodName);
    }
    
	/**
	 * Analyzes and parses the comment (if it was not previously done).
	 *
	 */
	private function analyzeComment() {
		if ($this->docComment == null) {
			$this->docComment = new MoufPhpDocComment($this->getDocComment());
		}
	}
	
	/**
	 * Returns the comment text, without the annotations.
	 *
	 * @return string
	 */
	public function getDocCommentWithoutAnnotations() {
		$this->analyzeComment();
		
		return $this->docComment->getComment();
	}
	
	/**
	 * Returns the number of declared annotations of type $annotationName in the class comment.
	 *
	 * @param string $annotationName
	 * @return int
	 */
	public function hasAnnotation($annotationName) {
		$this->analyzeComment();
		
		return ($this->docComment->getAnnotationsCount($annotationName) != 0);
	}
	
	/**
	 * Returns the annotation objects associated to $annotationName in an array.
	 * For instance, if there is one annotation "@Filter toto", there will be an array of one element.
	 * The element will contain an object of type FilterAnnotation. If the class FilterAnnotation is not defined,
	 * a string is returned instead of an object.  
	 *
	 * @param string $annotationName
	 * @return array<$objects>
	 */
	public function getAnnotations($annotationName) {
		$this->analyzeComment();
		
		return $this->docComment->getAnnotations($annotationName);
	}
	
	/**
	 * Returns a map associating the annotation title to an array of objects representing the annotation.
	 * 
	 * @var array("annotationClass"=>array($annotationObjects))
	 */
	public function getAllAnnotations() {
		$this->analyzeComment();
		
		return $this->docComment->getAllAnnotations();
	}


    /**
     * checks whether a value is equal to the class
     *
     * @param   mixed  $compare
     * @return  bool
     */
    public function equals($compare)
    {
        if ($compare instanceof self) {
            return ($compare->className === $this->className && $compare->methodName === $this->methodName);
        }
        
        return false;
    }


    /**
     * returns the class that declares this method
     *
     * @return  MoufReflectionClass
     */
    public function getDeclaringClass()
    {
    	if ($this->declaringClass) {
    		return $this->declaringClass;
    	}
    	 
    	$methodFile = $this->getFileName();
    	$methodStartLine = $this->getStartLine();
    	$methodEndLine = $this->getEndLine();
    	
    	$oldDeclaringClass = $this->getDeclaringClassWithoutTraits();
    	
    	// Let's scan all traits
    	$trait = $this->deepScanTraits($oldDeclaringClass->getTraits(), $methodFile, $methodStartLine, $methodEndLine);
    	if ($trait != null) {
    		$this->declaringClass = $trait;
    		return $trait;
    	} else {
    		$this->declaringClass = $oldDeclaringClass;
    		return $oldDeclaringClass;
    	}
    }
    
    /**
     * Recursive method called to detect a method into a nested array of traits.
     *
     * @param $traits ReflectionClass[]
     * @param $methodFile string
     * @param $methodStartLine int
     * @param $methodEndLine int
     * @return ReflectionClass|null
     */
    private function deepScanTraits(array $traits, $methodFile, $methodStartLine, $methodEndLine) {
    	foreach ($traits as $trait) {
    		// If the trait has a method, is it the method we see?
    		if ($trait->getFileName() == $methodFile
    				&& $trait->getStartLine() <= $methodStartLine
    				&& $trait->getEndLine() >= $methodEndLine) {
    			return $trait;
    		}
    		return $this->deepScanTraits($trait->getTraits(), $methodFile, $methodStartLine, $methodEndLine);
    	}
    	return null;
    }
    
    /**
     * This returns the declaring class, but with the PHP bug that makes it not return a trait.
     * See http://mouf-php.com/blog/php_reflection_api_traits 
     * 
     * @return \Mouf\Reflection\MoufReflectionClass
     */
    private function getDeclaringClassWithoutTraits()
    {
    	$refClass = parent::getDeclaringClass();
    	if ($refClass->getName() === $this->className) {
    		if (null === $this->refClass) {
    			$this->refClass = new MoufReflectionClass($this->className);
    		}
    
    		return $this->refClass;
    	}
    
    	$moufRefClass = new MoufReflectionClass($refClass->getName());
    	return $moufRefClass;
    }

    /**
     * returns a list of all parameters
     *
     * @return  array<MoufReflectionParameter>
     */
    public function getParameters()
    {
        $parameters     = parent::getParameters();
        $moufParameters = array();
        foreach ($parameters as $parameter) {
            $moufParameters[] = new MoufReflectionParameter($this, $parameter->getName());
        }
        
        return $moufParameters;
    }
    
    /**
     * Returns the MoufPhpDocComment instance
     *
     * @return MoufPhpDocComment
     */
    public function getMoufPhpDocComment() {
    	$this->analyzeComment();
    	return $this->docComment;
    }

   	/**
   	 * Appends this method to the XML node passed in parameter.
   	 *
   	 * @param SimpleXmlElement $root The root XML node the method will be appended to.
   	 */
    public function toXml(\SimpleXmlElement $root) {
    	$methodNode = $root->addChild("method");
    	$methodNode->addAttribute("name", $this->getName());
    	$modifier = "";
    	if ($this->isPublic()) {
    		$modifier = "public";
    	} elseif ($this->isProtected()) {
    		$modifier = "protected";
    	} elseif ($this->isPrivate()) {
    		$modifier = "private";
    	}
    	$methodNode->addAttribute("modifier", $modifier);
    	$methodNode->addAttribute("static", $this->isStatic()?"true":"false");
    	$methodNode->addAttribute("abstract", $this->isAbstract()?"true":"false");
    	$methodNode->addAttribute("constructor", $this->isConstructor()?"true":"false");
    	$methodNode->addAttribute("final", $this->isFinal()?"true":"false");
    	$commentNode = $methodNode->addChild("comment");
    	
    	$node= dom_import_simplexml($commentNode);
   		$no = $node->ownerDocument;
   		$node->appendChild($no->createCDATASection($this->getDocComment())); 
    	
    	
    	foreach ($this->getParameters() as $parameter) {
    		$parameter->toXml($methodNode);
    	}
    }

    /**
     * Returns a PHP array representing the method.
     *
     * @return array
     */
    public function toJson() {
    	$result = array();
    	$result['name'] = $this->getName();
    
    	$modifier = "";
    	if ($this->isPublic()) {
    		$modifier = "public";
    	} elseif ($this->isProtected()) {
    		$modifier = "protected";
    	} elseif ($this->isPrivate()) {
    		$modifier = "private";
    	}
    	$result['modifier'] = $modifier;
    	$result['static'] = $this->isStatic();
    	$result['abstract'] = $this->isAbstract();
    	$result['constructor'] = $this->isConstructor();
    	$result['final'] = $this->isFinal();
    	//$result['comment'] = $this->getDocComment();
    	$result['comment'] = $this->getMoufPhpDocComment()->getJsonArray();
    
    	$result['parameters'] = array();
    	$parameters = $this->getParameters();
    	foreach ($parameters as $parameter) {
    		$result['parameters'][] = $parameter->toJson();
    	}
    
    	//$properties = $this->getAnnotations("Property");
    	try {
    		/*if (!empty($properties)) {
    		 $result['moufProperty'] = true;*/
    		
    		// TODO: is there a need to instanciate a  MoufPropertyDescriptor?
    		
    		// If this is a setter only:
    		
    		if ($this->isSetter()) {
	    		$moufPropertyDescriptor = new MoufPropertyDescriptor($this);
	    		$types = $moufPropertyDescriptor->getTypes();
	    		$result['types'] = $types->toJson();
	    		
	    		if ($types->getWarningMessage()) {
	    			$result['classinerror'] = $types->getWarningMessage();
	    		}
    		}
    		
    		/*if ($moufPropertyDescriptor->isAssociativeArray()) {
    			$result['keytype'] = $moufPropertyDescriptor->getKeyType();
    		}
    		if ($moufPropertyDescriptor->isArray()) {
    			$result['subtype'] = $moufPropertyDescriptor->getSubType();
    		}*/
    		//}
    	} catch (\Exception $e) {
    		$result['classinerror'] = $e->getMessage();
    	}
    	
    
    	return $result;
    }
    
    /**
     * Returns true if this method has the signature of a setter.
     * 
     * @return boolean
     */
    public function isSetter() {
    	$methodName = $this->getName();
    	
    	   
    	if (strpos($methodName, "set") === 0 && strlen($methodName)>3) {
    		// A setter must have exactly one compulsory parameter
    		$parameters = $this->getParameters();
    		if (count($parameters) == 0) {
    			return false;
    		}
    		if (count($parameters)>1) {
    			for ($i=1, $count=count($parameters); $i<$count; $i++) {
    				$param = $parameters[$i];
    				if (!$param->isDefaultValueAvailable()) {
    					return false;
    				}
    			}
    		}
    		
    		return true;
    	}
    	return false;
    }
}
?>